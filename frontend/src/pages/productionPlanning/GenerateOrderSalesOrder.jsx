import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Avatar, Tabs, Tab,
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
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GroupsIcon from '@mui/icons-material/Groups';
import BuildIcon from '@mui/icons-material/Build';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Generate Order - Sales Order" screen, built to
// match the reference design the user supplied. Same convention as the other
// Production Planning Generate Order screens already built this way
// (Generate Order - MRP, Generate Order - Manual, Order Generation Options,
// Generated Orders): there is no BOM, stock or sales-order-fulfilment data
// model wired to production planning anywhere in this schema, so this lays
// out the screen exactly as designed with fixed mock data rather than
// fabricating "real" numbers against tables that don't exist. Local state
// only -- nothing here persists or calls the server; only the 5 method cards
// and the Preview/Generate Orders actions actually navigate (to the other
// already-built Generate Order pages).
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
    key: 'project', path: '/production-planning/generate-order-project', label: 'Project', desc: 'Based on project / job requirement',
    icon: WorkOutlineIcon, color: '#00695c', a: { label: 'Projects', value: '6' }, b: { label: 'Net Qty', value: '3,800' },
  },
];

const TABS = [
  { key: 'open', label: 'Open Sales Orders (12)' },
  { key: 'partial', label: 'Partially Delivered (2)' },
  { key: 'back', label: 'Back Orders (1)' },
];

const SALES_ORDERS = [
  { no: 'SO-2026-09-001', customer: 'ABC Engineering', orderDate: '25-Sep-2026', deliveryDate: '05-Oct-2026', status: 'Open', openQty: 100, selectQty: 100 },
  { no: 'SO-2026-09-002', customer: 'XYZ Industries', orderDate: '26-Sep-2026', deliveryDate: '08-Oct-2026', status: 'Open', openQty: 200, selectQty: 200 },
  { no: 'SO-2026-09-003', customer: 'LMN Fabrication', orderDate: '28-Sep-2026', deliveryDate: '12-Oct-2026', status: 'Open', openQty: 150, selectQty: 150 },
  { no: 'SO-2026-09-004', customer: 'PQR Pvt Ltd', orderDate: '29-Sep-2026', deliveryDate: '15-Oct-2026', status: 'Open', openQty: 250, selectQty: 0 },
  { no: 'SO-2026-09-005', customer: 'Siva Textiles', orderDate: '29-Sep-2026', deliveryDate: '18-Oct-2026', status: 'Open', openQty: 300, selectQty: 0 },
];

const TOTAL_SO_RECORDS = 12; // cosmetic -- matches "Showing 1 to 5 of 12 records"; only page 1's 5 rows are mocked.

const SELECTED_ITEM = {
  code: 'FG-1001', name: 'Gear Housing', uom: 'Nos', bomVersion: 'BOM-001 (A)',
  currentStock: 1200, onOrder: 800, available: 400,
};

const SELECTED_SALES_ORDER_DETAILS = [
  { label: 'Sales Order No.', value: 'SO-2026-09-001' },
  { label: 'Customer', value: 'ABC Engineering' },
  { label: 'Order Date', value: '25-Sep-2026' },
  { label: 'Delivery Date', value: '05-Oct-2026' },
  { label: 'Open Qty', value: '100 Nos' },
  { label: 'Select Qty', value: '100 Nos' },
];

const BOM_COMPONENTS = [
  { code: 'RM-001', desc: 'Casting', reqQty: 1.0, type: 'Make' },
  { code: 'RM-002', desc: 'Bush', reqQty: 2.0, type: 'Buy' },
  { code: 'RM-003', desc: 'Seal', reqQty: 4.0, type: 'Buy' },
  { code: 'RM-004', desc: 'Gear Blank', reqQty: 1.0, type: 'Subcontract' },
];
const PROCUREMENT_TYPE_COLOR = { Make: 'success', Buy: 'warning', Subcontract: 'secondary' };

const ORDER_PREVIEW_CARDS = [
  { key: 'production', label: 'Production Orders', icon: PrecisionManufacturingIcon, color: 'info', items: 3, qty: '500', unit: 'Nos' },
  { key: 'purchase', label: 'Purchase Orders', icon: ShoppingCartIcon, color: 'warning', items: 2, qty: '120', unit: 'Nos' },
  { key: 'subcontracting', label: 'Subcontracting Orders', icon: GroupsIcon, color: 'secondary', items: 0, qty: '0', unit: 'Nos' },
  { key: 'jobwork', label: 'Job Work Orders', icon: BuildIcon, color: 'success', items: 0, qty: '0', unit: 'Nos' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function GenerateOrderSalesOrder() {
  const navigate = useNavigate();
  const [goNumber, setGoNumber] = useState('GO-2026-10-003');
  const [goDate, setGoDate] = useState('2026-10-01');
  const [requiredDate, setRequiredDate] = useState('2026-12-31');
  const [plant, setPlant] = useState('Main Plant');
  const [customer, setCustomer] = useState('All Customers');
  const [notes, setNotes] = useState('');

  const [tab, setTab] = useState('open');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set(['SO-2026-09-001', 'SO-2026-09-002', 'SO-2026-09-003']));
  const [selectQtyByNo, setSelectQtyByNo] = useState(() => Object.fromEntries(SALES_ORDERS.map((r) => [r.no, r.selectQty])));
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [activeOrder, setActiveOrder] = useState('SO-2026-09-001');
  const [panelTab, setPanelTab] = useState('soDetails');

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

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Generate Order"
        subtitle="Create Production, Purchase, Subcontracting and Job Work orders from MRP, Manual selection, Sales Order, Forecast or Project."
      />

      {/* Method selector */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = m.key === 'sales-order';
          return (
            <Grid item xs={12} sm={6} md={2.4} key={m.key}>
              <Card
                variant="outlined"
                onClick={() => !active && navigate(m.path)}
                sx={{
                  cursor: active ? 'default' : 'pointer', height: '100%',
                  borderColor: active ? 'success.main' : 'divider', borderWidth: active ? 2 : 1,
                  bgcolor: active ? 'rgba(46, 125, 50, 0.06)' : 'background.paper',
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
                        borderColor: active ? 'success.main' : 'divider',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {active && <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: 'success.main' }} />}
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
            Step 1: Sales Order Selection &amp; GO Details
          </Typography>
          <Grid container spacing={2.5}>
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
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" select label="Plant / Location"
                value={plant} onChange={(e) => setPlant(e.target.value)}
              >
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" select label="Customer"
                value={customer} onChange={(e) => setCustomer(e.target.value)}
              >
                <MenuItem value="All Customers">All Customers</MenuItem>
                <MenuItem value="ABC Engineering">ABC Engineering</MenuItem>
                <MenuItem value="XYZ Industries">XYZ Industries</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
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
          sx={{ px: 3, pt: 2.5, pb: 1 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={700}>Step 2: Select Sales Orders</Typography>
            <Chip size="small" label={15} color="primary" />
          </Stack>
        </Stack>

        <Stack
          direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}
          sx={{ px: 3, pb: 1 }}
        >
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}
          >
            {TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
          </Tabs>
        </Stack>

        <Grid container>
          <Grid item xs={12} md={8} lg={8.5}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 3, pb: 1.5 }} flexWrap="wrap" useFlexGap>
              <TextField
                size="small"
                placeholder="Search Sales Order, Customer, Item..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                sx={{ minWidth: 280, ml: 'auto' }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <Button variant="outlined" size="small" startIcon={<FilterAltOutlinedIcon />}>Filter</Button>
            </Stack>

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
                    <TableCell>Order Date</TableCell>
                    <TableCell>Delivery Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Open Qty (Nos)</TableCell>
                    <TableCell align="right">Select Qty (Nos)</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow
                      key={r.no} hover selected={activeOrder === r.no}
                      onClick={() => setActiveOrder(r.no)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selected.has(r.no)} onClick={(e) => e.stopPropagation()} onChange={() => toggleRow(r.no)} />
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.no}</Typography></TableCell>
                      <TableCell>{r.customer}</TableCell>
                      <TableCell>{r.orderDate}</TableCell>
                      <TableCell>{r.deliveryDate}</TableCell>
                      <TableCell><Chip size="small" label={r.status} color="success" variant="outlined" /></TableCell>
                      <TableCell align="right">{numberFmt(r.openQty)}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
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

          {/* Item Details side panel */}
          <Grid item xs={12} md={4} lg={3.5}>
            <Box sx={{ p: 2.5, borderLeft: { md: '1px solid' }, borderColor: 'divider', height: '100%' }}>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>
                Item Details ({selected.size} item{selected.size === 1 ? '' : 's'} selected)
              </Typography>

              <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
                <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: 'action.hover' }}>
                  <PrecisionManufacturingIcon color="disabled" />
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{SELECTED_ITEM.code} - {SELECTED_ITEM.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    UOM: {SELECTED_ITEM.uom} &nbsp;|&nbsp; BOM Version: {SELECTED_ITEM.bomVersion}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Current Stock: {numberFmt(SELECTED_ITEM.currentStock)} {SELECTED_ITEM.uom}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    On Order: {numberFmt(SELECTED_ITEM.onOrder)} {SELECTED_ITEM.uom} &nbsp;|&nbsp; Available: {numberFmt(SELECTED_ITEM.available)} {SELECTED_ITEM.uom}
                  </Typography>
                </Box>
              </Stack>

              <Tabs
                value={panelTab}
                onChange={(e, v) => setPanelTab(v)}
                variant="fullWidth"
                sx={{ minHeight: 36, mb: 1.5, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 } }}
              >
                <Tab value="soDetails" label="Sales Order Details" />
                <Tab value="bom" label="BOM & Routing" />
              </Tabs>

              {panelTab === 'soDetails' ? (
                <Stack spacing={1}>
                  {SELECTED_SALES_ORDER_DETAILS.map((d) => (
                    <Stack key={d.label} direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">{d.label}</Typography>
                      <Typography variant="caption" fontWeight={600}>{d.value}</Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    BOM (12 Components)
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>S.No</TableCell>
                        <TableCell>Component</TableCell>
                        <TableCell align="right">Req. Qty</TableCell>
                        <TableCell>Type</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {BOM_COMPONENTS.map((c, idx) => (
                        <TableRow key={c.code}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <Typography variant="caption" fontWeight={600}>{c.code}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{c.desc}</Typography>
                          </TableCell>
                          <TableCell align="right">{c.reqQty.toFixed(2)}</TableCell>
                          <TableCell>
                            <Chip size="small" label={c.type} color={PROCUREMENT_TYPE_COLOR[c.type]} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
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
                          <Typography variant="caption" color="text.secondary">Items</Typography>
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

          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
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
