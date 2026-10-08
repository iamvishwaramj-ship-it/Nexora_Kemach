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
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GroupsIcon from '@mui/icons-material/Groups';
import BuildIcon from '@mui/icons-material/Build';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import TuneIcon from '@mui/icons-material/Tune';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Generate Order - MRP" screen, built to match
// the reference design the user supplied. Same convention as
// pages/purchase/PurchaseOrderPrintPreview.jsx and the Production Planning >
// Dashboard page: there is no MRP Run, BOM, Routing/Operations, or
// Make/Buy/Subcontract classification data model anywhere in this schema —
// nothing here (requirements, BOM components, routing operations, stock
// availability, order type suggestions) has a real backing table, so this
// lays out the screen exactly as designed with fixed mock data rather than
// fabricating "real" numbers against tables that don't exist. The user
// explicitly chose this static-mock option (same choice made for the
// Dashboard screen) when asked. Local state only -- nothing here persists or
// calls the server; only the 5 method cards actually navigate (to the other
// already-built Generate Order pages), since that costs nothing to make real.
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

const MRP_SUMMARY = [
  { label: 'Total Requirements', value: 52, color: 'text.primary' },
  { label: 'Already Covered', value: 20, color: 'success.main' },
  { label: 'In Progress', value: 12, color: 'warning.main' },
  { label: 'On Hold', value: 5, color: 'error.main' },
  { label: 'Net to Generate', value: 15, color: 'primary.main' },
];

const ORDER_TYPE_META = {
  'Production Order': { color: 'info' },
  'Purchase Order': { color: 'warning' },
  'Subcontracting Order': { color: 'secondary' },
  'Job Work Order': { color: 'success' },
};

const REQUIREMENTS = [
  { code: 'FG-1001', desc: 'Gear Housing', mrpReq: 2000, covered: 500, inProgress: 800, onHold: 200, net: 500, uom: 'Nos', date: '05-Oct-2026', orderType: 'Production Order' },
  { code: 'FG-1002', desc: 'Motor Bracket', mrpReq: 1500, covered: 300, inProgress: 600, onHold: 100, net: 500, uom: 'Nos', date: '06-Oct-2026', orderType: 'Purchase Order' },
  { code: 'FG-1003', desc: 'Pump Cover', mrpReq: 800, covered: 0, inProgress: 400, onHold: 0, net: 400, uom: 'Nos', date: '08-Oct-2026', orderType: 'Production Order' },
  { code: 'FG-1004', desc: 'Shaft Assembly', mrpReq: 1200, covered: 200, inProgress: 800, onHold: 0, net: 200, uom: 'Nos', date: '10-Oct-2026', orderType: 'Subcontracting Order' },
  { code: 'FG-1005', desc: 'Valve Body', mrpReq: 600, covered: 0, inProgress: 400, onHold: 0, net: 200, uom: 'Nos', date: '12-Oct-2026', orderType: 'Production Order' },
  { code: 'FG-1006', desc: 'Flange Plate', mrpReq: 400, covered: 0, inProgress: 0, onHold: 0, net: 400, uom: 'Nos', date: '15-Oct-2026', orderType: 'Purchase Order' },
  { code: 'FG-1007', desc: 'Bearing Housing', mrpReq: 300, covered: 0, inProgress: 0, onHold: 0, net: 300, uom: 'Nos', date: '18-Oct-2026', orderType: 'Job Work Order' },
  { code: 'FG-1008', desc: 'Heat Treatment Part', mrpReq: 500, covered: 0, inProgress: 200, onHold: 0, net: 300, uom: 'Nos', date: '20-Oct-2026', orderType: 'Subcontracting Order' },
];

const TOTAL_REQUIREMENT_RECORDS = 15; // cosmetic -- matches "Showing 1 to 8 of 15 records"; only page 1's 8 rows are mocked.

const BOM_COMPONENTS = [
  { code: 'RM-001', desc: 'Casting', reqQty: 1.0, type: 'Make' },
  { code: 'RM-002', desc: 'Bush', reqQty: 2.0, type: 'Buy' },
  { code: 'RM-003', desc: 'Seal', reqQty: 4.0, type: 'Buy' },
  { code: 'RM-004', desc: 'Gear Blank', reqQty: 1.0, type: 'Subcontract' },
];
const BOM_TOTAL_COMPONENTS = 12; // cosmetic -- "View all components (12)"

const PROCUREMENT_TYPE_COLOR = { Make: 'success', Buy: 'warning', Subcontract: 'secondary' };

const SELECTED_ITEM = { code: 'FG-1001', name: 'Gear Housing', uom: 'Nos', netQty: 500, requiredDate: '05-Oct-2026' };

const ORDER_PREVIEW_CARDS = [
  { key: 'production', label: 'Production Orders', icon: PrecisionManufacturingIcon, color: 'info', items: 2, qty: '900', unit: 'Nos' },
  { key: 'purchase', label: 'Purchase Orders', icon: ShoppingCartIcon, color: 'warning', items: 1, qty: '500', unit: 'Nos' },
  { key: 'subcontracting', label: 'Subcontracting Orders', icon: GroupsIcon, color: 'secondary', items: 0, qty: '0', unit: 'Nos' },
  { key: 'jobwork', label: 'Job Work Orders', icon: BuildIcon, color: 'success', items: 0, qty: '0', unit: 'Nos' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function GenerateOrderMrp() {
  const navigate = useNavigate();
  const [goNumber, setGoNumber] = useState('GO-2026-10-001');
  const [mrpRun, setMrpRun] = useState('MRP-2026-10-01 (01-Oct-2026)');
  const [goDate, setGoDate] = useState('2026-10-01');
  const [requiredDate, setRequiredDate] = useState('2026-12-31');
  const [plant, setPlant] = useState('Main Plant');
  const [notes, setNotes] = useState('');

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set(['FG-1001', 'FG-1002', 'FG-1003', 'FG-1004']));
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [activeItem, setActiveItem] = useState('FG-1001');
  const [panelTab, setPanelTab] = useState('bom');
  const [expanded, setExpanded] = useState('routing');

  const rows = REQUIREMENTS.filter((r) => {
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
          const active = m.key === 'mrp';
          return (
            <Grid item xs={12} sm={6} md={2.4} key={m.key}>
              <Card
                variant="outlined"
                onClick={() => !active && navigate(m.path)}
                sx={{
                  cursor: active ? 'default' : 'pointer', height: '100%',
                  borderColor: active ? 'warning.main' : 'divider', borderWidth: active ? 2 : 1,
                  bgcolor: active ? 'rgba(255, 152, 0, 0.06)' : 'background.paper',
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
                        borderColor: active ? 'warning.main' : 'divider',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {active && <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: 'warning.main' }} />}
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
            Step 1: MRP Selection &amp; GO Details
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
                fullWidth size="small" select label="MRP Run" required
                value={mrpRun} onChange={(e) => setMrpRun(e.target.value)}
              >
                <MenuItem value="MRP-2026-10-01 (01-Oct-2026)">MRP-2026-10-01 (01-Oct-2026)</MenuItem>
                <MenuItem value="MRP-2026-09-01 (01-Sep-2026)">MRP-2026-09-01 (01-Sep-2026)</MenuItem>
              </TextField>
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
            <Grid item xs={12} sm={6} md={1.2}>
              <TextField
                fullWidth size="small" select label="Plant / Location"
                value={plant} onChange={(e) => setPlant(e.target.value)}
              >
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.2}>
              <TextField
                fullWidth size="small" label="Notes" placeholder="Enter remarks..."
                value={notes} onChange={(e) => setNotes(e.target.value)}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={8}>
              <Card variant="outlined" sx={{ height: '100%', bgcolor: 'action.hover' }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>MRP Summary (for selected run)</Typography>
                  <Grid container spacing={2}>
                    {MRP_SUMMARY.map((s) => (
                      <Grid item xs={6} sm={2.4} key={s.label}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{s.label}</Typography>
                        <Typography variant="h6" fontWeight={700} color={s.color}>{s.value}</Typography>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ height: '100%', bgcolor: 'rgba(76, 175, 80, 0.06)', borderColor: 'success.light' }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>What will be considered?</Typography>
                  <Stack spacing={0.75}>
                    {[
                      'Considers current stock, reserved stock and open receipts',
                      'Considers existing Production / Purchase / Subcontracting / Job Work orders',
                      'Considers planned lead time and due date',
                    ].map((t) => (
                      <Stack key={t} direction="row" spacing={1} alignItems="flex-start">
                        <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', mt: 0.25 }} />
                        <Typography variant="caption">{t}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
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
            <Typography variant="subtitle1" fontWeight={700}>Step 2: MRP Planned Requirements (Net to Generate)</Typography>
            <Chip size="small" label={MRP_SUMMARY[4].value} color="primary" />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size="small" startIcon={<VisibilityOutlinedIcon />}>View MRP Details</Button>
            <Button variant="outlined" size="small" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
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
                    <TableCell align="right">MRP Req. Qty</TableCell>
                    <TableCell align="right">Already Covered</TableCell>
                    <TableCell align="right">In Progress</TableCell>
                    <TableCell align="right">On Hold</TableCell>
                    <TableCell align="right">Net Qty to Generate</TableCell>
                    <TableCell>UOM</TableCell>
                    <TableCell>Required Date</TableCell>
                    <TableCell>Suggested Order Type</TableCell>
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
                      <TableCell align="right">{numberFmt(r.mrpReq)}</TableCell>
                      <TableCell align="right">{numberFmt(r.covered)}</TableCell>
                      <TableCell align="right">{numberFmt(r.inProgress)}</TableCell>
                      <TableCell align="right">{numberFmt(r.onHold)}</TableCell>
                      <TableCell align="right"><Typography variant="body2" color="primary.main" fontWeight={700}>{numberFmt(r.net)}</Typography></TableCell>
                      <TableCell>{r.uom}</TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>
                        <Chip size="small" label={r.orderType} color={ORDER_TYPE_META[r.orderType]?.color || 'default'} variant="outlined" />
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
              total={TOTAL_REQUIREMENT_RECORDS}
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
                    UOM: {SELECTED_ITEM.uom} &nbsp;|&nbsp; Net Qty to Generate: {numberFmt(SELECTED_ITEM.netQty)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Required Date: {SELECTED_ITEM.requiredDate}</Typography>
                </Box>
              </Stack>

              <ToggleButtonGroup
                size="small" exclusive fullWidth value={panelTab}
                onChange={(e, v) => v && setPanelTab(v)}
                sx={{ mb: 1.5 }}
              >
                <ToggleButton value="bom">BOM &amp; Routing</ToggleButton>
                <ToggleButton value="status">Current Status</ToggleButton>
              </ToggleButtonGroup>

              {panelTab === 'bom' ? (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    BOM ({BOM_TOTAL_COMPONENTS} Components)
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
                  <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ display: 'block', mt: 1, cursor: 'pointer' }}>
                    View all components ({BOM_TOTAL_COMPONENTS}) →
                  </Typography>

                  {[
                    { key: 'routing', title: 'Routing (5 Operations)', link: 'View Routing' },
                    { key: 'stock', title: 'Stock Availability' },
                    { key: 'orders', title: 'Existing Orders & Reservations' },
                    { key: 'netreq', title: 'Net Requirement Calculation' },
                  ].map((section) => (
                    <Accordion
                      key={section.key} disableGutters square
                      expanded={expanded === section.key}
                      onChange={() => setExpanded(expanded === section.key ? '' : section.key)}
                      sx={{ mt: 1, border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40 }}>
                        <Typography variant="caption" fontWeight={700}>{section.title}</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="caption" color="text.secondary">
                          {section.link
                            ? <>5 operations across 3 work centers. </>
                            : 'No further detail in this preview.'}
                        </Typography>
                        {section.link && (
                          <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ display: 'block', mt: 0.5, cursor: 'pointer' }}>
                            {section.link} →
                          </Typography>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  No open Production/Purchase/Subcontracting/Job Work orders for this item.
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
            <Button variant="outlined" startIcon={<TuneIcon />} onClick={() => navigate('/production-planning/order-generation-option')}>
              Order Generation Options
            </Button>
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
