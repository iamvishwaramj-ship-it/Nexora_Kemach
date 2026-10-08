import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Avatar, Accordion, AccordionSummary, AccordionDetails,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsightsIcon from '@mui/icons-material/Insights';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GroupsIcon from '@mui/icons-material/Groups';
import BuildIcon from '@mui/icons-material/Build';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Generate Order - Manual" screen, built to
// match the reference design the user supplied. Same convention as the other
// Production Planning Generate Order screens already built this way
// (Generate Order - MRP, Order Generation Options, Generated Orders): there
// is no BOM, Routing, stock, or order-type-classification data model
// anywhere in this schema, so this lays out the screen exactly as designed
// with fixed mock data rather than fabricating "real" numbers against tables
// that don't exist. Local state only -- nothing here persists or calls the
// server; only the 5 method cards and the Preview/Generate Orders actions
// actually navigate (to the other already-built Generate Order pages).
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

const ORDER_TYPES = ['Production Order', 'Purchase Order', 'Subcontracting Order', 'Job Work Order'];
const ORDER_TYPE_META = {
  'Production Order': { color: 'info' },
  'Purchase Order': { color: 'warning' },
  'Subcontracting Order': { color: 'secondary' },
  'Job Work Order': { color: 'success' },
};

const ITEMS = [
  { code: 'FG-1001', desc: 'Gear Housing', bomVersion: 'BOM-001 (A)', uom: 'Nos', qty: 500, date: '05-Oct-2026', orderType: 'Production Order', remarks: 'Urgent' },
  { code: 'FG-1002', desc: 'Motor Bracket', bomVersion: 'BOM-001 (A)', uom: 'Nos', qty: 300, date: '06-Oct-2026', orderType: 'Purchase Order', remarks: '-' },
  { code: 'FG-1003', desc: 'Pump Cover', bomVersion: 'BOM-002 (B)', uom: 'Nos', qty: 200, date: '08-Oct-2026', orderType: 'Production Order', remarks: 'Customer Demand' },
  { code: 'FG-1004', desc: 'Shaft Assembly', bomVersion: 'BOM-003 (A)', uom: 'Nos', qty: 100, date: '10-Oct-2026', orderType: 'Production Order', remarks: '-' },
  { code: 'FG-1005', desc: 'Valve Body', bomVersion: 'BOM-001 (A)', uom: 'Nos', qty: 150, date: '12-Oct-2026', orderType: 'Subcontracting Order', remarks: '-' },
  { code: 'FG-1006', desc: 'Flange Plate', bomVersion: 'BOM-001 (A)', uom: 'Nos', qty: 250, date: '15-Oct-2026', orderType: 'Purchase Order', remarks: '-' },
  { code: 'FG-1007', desc: 'Bearing Housing', bomVersion: 'BOM-004 (A)', uom: 'Nos', qty: 100, date: '18-Oct-2026', orderType: 'Job Work Order', remarks: '-' },
  { code: 'FG-1008', desc: 'Heat Treatment Part', bomVersion: 'BOM-002 (B)', uom: 'Nos', qty: 150, date: '20-Oct-2026', orderType: 'Subcontracting Order', remarks: '-' },
];

const TOTAL_ITEM_RECORDS = 28; // cosmetic -- matches "Showing 1 to 8 of 28 records"; only page 1's 8 rows are mocked.

const BOM_COMPONENTS = [
  { code: 'RM-001', desc: 'Casting', reqQty: 1.0, type: 'Make' },
  { code: 'RM-002', desc: 'Bush', reqQty: 2.0, type: 'Buy' },
  { code: 'RM-003', desc: 'Seal', reqQty: 4.0, type: 'Buy' },
  { code: 'RM-004', desc: 'Gear Blank', reqQty: 1.0, type: 'Subcontract' },
];
const BOM_TOTAL_COMPONENTS = 12; // cosmetic -- "View all components (12)"

const PROCUREMENT_TYPE_COLOR = { Make: 'success', Buy: 'warning', Subcontract: 'secondary' };

const SELECTED_ITEM = {
  code: 'FG-1001', name: 'Gear Housing', uom: 'Nos', bomVersion: 'BOM-001 (A)',
  currentStock: 1200, onOrder: 800, available: 400,
};

const ORDER_PREVIEW_CARDS = [
  { key: 'production', label: 'Production Orders', icon: PrecisionManufacturingIcon, color: 'info', items: 2, qty: '700', unit: 'Nos' },
  { key: 'purchase', label: 'Purchase Orders', icon: ShoppingCartIcon, color: 'warning', items: 1, qty: '300', unit: 'Nos' },
  { key: 'subcontracting', label: 'Subcontracting Orders', icon: GroupsIcon, color: 'secondary', items: 0, qty: '0', unit: 'Nos' },
  { key: 'jobwork', label: 'Job Work Orders', icon: BuildIcon, color: 'success', items: 0, qty: '0', unit: 'Nos' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function GenerateOrderManual() {
  const navigate = useNavigate();
  const [goNumber, setGoNumber] = useState('GO-2026-10-002');
  const [goDate, setGoDate] = useState('2026-10-01');
  const [requiredDate, setRequiredDate] = useState('2026-12-31');
  const [plant, setPlant] = useState('Main Plant');
  const [notes, setNotes] = useState('');

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set(['FG-1001', 'FG-1002', 'FG-1003']));
  const [qtyByCode, setQtyByCode] = useState(() => Object.fromEntries(ITEMS.map((r) => [r.code, r.qty])));
  const [orderTypeByCode, setOrderTypeByCode] = useState(() => Object.fromEntries(ITEMS.map((r) => [r.code, r.orderType])));
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [activeItem, setActiveItem] = useState('FG-1001');
  const [panelTab, setPanelTab] = useState('bom');
  const [expanded, setExpanded] = useState('routing');

  const rows = ITEMS.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.code.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q);
  });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.code));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((r) => next.delete(r.code));
      else rows.forEach((r) => next.add(r.code));
      return next;
    });
  };
  const toggleRow = (code) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
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
          const active = m.key === 'manual';
          return (
            <Grid item xs={12} sm={6} md={2.4} key={m.key}>
              <Card
                variant="outlined"
                onClick={() => !active && navigate(m.path)}
                sx={{
                  cursor: active ? 'default' : 'pointer', height: '100%',
                  borderColor: active ? 'primary.main' : 'divider', borderWidth: active ? 2 : 1,
                  bgcolor: active ? 'rgba(21, 101, 192, 0.06)' : 'background.paper',
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
                        borderColor: active ? 'primary.main' : 'divider',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {active && <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: 'primary.main' }} />}
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
            Step 1: Manual Selection &amp; GO Details
          </Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2.4}>
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
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" type="date" label="GO Date" required
                value={goDate} onChange={(e) => setGoDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" type="date" label="Required Delivery Date"
                value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" select label="Plant / Location"
                value={plant} onChange={(e) => setPlant(e.target.value)}
              >
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
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
            <Typography variant="subtitle1" fontWeight={700}>Step 2: Select Items to Generate (Manual)</Typography>
            <Chip size="small" label={selected.size} color="primary" />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size="small" startIcon={<AddCircleOutlineIcon />}>Add Items</Button>
            <Button variant="outlined" size="small" startIcon={<UploadFileOutlinedIcon />}>Import from Excel</Button>
          </Stack>
        </Stack>

        <Grid container>
          <Grid item xs={12} md={8} lg={8.5}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 3, pb: 1.5 }} flexWrap="wrap" useFlexGap>
              <Checkbox size="small" checked={allSelected} onChange={toggleAll} />
              <Typography variant="body2" color="text.secondary">Select All</Typography>
              <TextField
                size="small"
                placeholder="Search item, FG code or description..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                sx={{ minWidth: 260, ml: 'auto' }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <IconButton size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
                <FilterAltOutlinedIcon fontSize="small" />
              </IconButton>
            </Stack>

            <ScrollableTableContainer maxHeight="clamp(240px, calc(100vh - 560px), 420px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>S.No</TableCell>
                    <TableCell>FG Item Code</TableCell>
                    <TableCell>FG Description</TableCell>
                    <TableCell>BOM Version</TableCell>
                    <TableCell>UOM</TableCell>
                    <TableCell align="right">Order Qty</TableCell>
                    <TableCell>Required Date</TableCell>
                    <TableCell>Suggest Order Type</TableCell>
                    <TableCell>Remarks</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow
                      key={r.code} hover selected={activeItem === r.code}
                      onClick={() => setActiveItem(r.code)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selected.has(r.code)} onClick={(e) => e.stopPropagation()} onChange={() => toggleRow(r.code)} />
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.code}</Typography></TableCell>
                      <TableCell>{r.desc}</TableCell>
                      <TableCell>{r.bomVersion}</TableCell>
                      <TableCell>{r.uom}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <TextField
                          size="small" type="number" value={qtyByCode[r.code]}
                          onChange={(e) => setQtyByCode((prev) => ({ ...prev, [r.code]: e.target.value }))}
                          sx={{ width: 90 }}
                          inputProps={{ style: { textAlign: 'right' } }}
                        />
                      </TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <TextField
                          size="small" select value={orderTypeByCode[r.code]}
                          onChange={(e) => setOrderTypeByCode((prev) => ({ ...prev, [r.code]: e.target.value }))}
                          sx={{ minWidth: 170 }}
                          SelectProps={{
                            renderValue: (val) => <Chip size="small" label={val} color={ORDER_TYPE_META[val]?.color || 'default'} variant="outlined" />,
                          }}
                        >
                          {ORDER_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell>{r.remarks}</TableCell>
                      <TableCell>
                        <Button size="small" endIcon={<KeyboardArrowDownIcon />}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>

            <EntityListPagination
              total={TOTAL_ITEM_RECORDS}
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

              <ToggleButtonGroup
                size="small" exclusive fullWidth value={panelTab}
                onChange={(e, v) => v && setPanelTab(v)}
                sx={{ mb: 1.5 }}
              >
                <ToggleButton value="bom">BOM &amp; Routing</ToggleButton>
                <ToggleButton value="status">Current Status</ToggleButton>
                <ToggleButton value="orders">Existing Orders</ToggleButton>
              </ToggleButtonGroup>

              {panelTab === 'bom' ? (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      BOM ({BOM_TOTAL_COMPONENTS} Components)
                    </Typography>
                    <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ cursor: 'pointer' }}>
                      View BOM
                    </Typography>
                  </Stack>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>S.No</TableCell>
                        <TableCell>Component Code</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Req. Qty</TableCell>
                        <TableCell>Procurement</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {BOM_COMPONENTS.map((c, idx) => (
                        <TableRow key={c.code}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell><Typography variant="caption" fontWeight={600}>{c.code}</Typography></TableCell>
                          <TableCell><Typography variant="caption">{c.desc}</Typography></TableCell>
                          <TableCell align="right">{c.reqQty.toFixed(3)}</TableCell>
                          <TableCell>
                            <Chip size="small" label={c.type} color={PROCUREMENT_TYPE_COLOR[c.type]} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {[
                    { key: 'routing', title: 'Routing (5 Operations)', link: 'View Routing' },
                    { key: 'stock', title: 'Stock Availability', link: 'View Stock' },
                    { key: 'orders', title: 'Existing Orders & Reservations', link: 'View Orders' },
                    { key: 'netreq', title: 'Net Requirement Calculation', link: 'View Details' },
                  ].map((section) => (
                    <Accordion
                      key={section.key} disableGutters square
                      expanded={expanded === section.key}
                      onChange={() => setExpanded(expanded === section.key ? '' : section.key)}
                      sx={{ mt: 1, border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { justifyContent: 'space-between', alignItems: 'center', pr: 1 } }}
                      >
                        <Typography variant="caption" fontWeight={700}>{section.title}</Typography>
                        <Typography variant="caption" color="primary.main" fontWeight={600}>{section.link}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="caption" color="text.secondary">
                          {section.key === 'routing'
                            ? '5 operations across 3 work centers.'
                            : 'No further detail in this preview.'}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </>
              ) : panelTab === 'status' ? (
                <Typography variant="caption" color="text.secondary">
                  No open Production/Purchase/Subcontracting/Job Work orders for this item.
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  No existing orders or reservations for this item.
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Step 3 */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>
            Step 3: Order Generation Preview ({selected.size} Item{selected.size === 1 ? '' : 's'} Selected)
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
