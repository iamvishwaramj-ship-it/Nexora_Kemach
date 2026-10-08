import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell, Divider,
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import SettingsIcon from '@mui/icons-material/Settings';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Order - View" screen with its
// Product Cost tab active, built to match the reference design the user
// supplied for the Production Execution > Product Cost submenu. Same
// convention as the other Production Execution screens (Production Orders,
// View Order, Operations, Material Requisition, Material Issue, Material
// Receipt, Create Issue, Record Production): there is no ProductionOrder /
// cost-accounting data model in this schema, so this lays out the screen
// exactly as designed with fixed mock data for one order (PO-2026-001)
// rather than fabricating "real" records against tables that don't exist.
// Local state only -- nothing here persists or calls the server; the tab
// strip just switches which panel label is active (only "Product Cost" has
// mock content here, matching the reference image -- the other tabs show a
// neutral empty state, same pattern used on the other tabbed Production
// Execution pages).
// ---------------------------------------------------------------------------

const ORDER = {
  no: 'PO-2026-001',
  orderDate: '01-Oct-2026',
  plannedStart: '01-Oct-2026',
  plannedEnd: '10-Oct-2026',
  status: 'Released',
  priority: 'High',
  itemCode: 'FG-1001',
  itemDesc: 'Gear Housing',
  uom: 'Nos',
  plannedQty: 500,
  producedQty: 320,
  balanceQty: 180,
  productionType: 'In-House',
  project: 'PRJ-2026-001',
  salesOrder: 'SO-2026-09-001',
  plant: 'Main Plant',
  workCenter: 'WC-01 - Machining',
  routingVersion: 'V1',
  bomVersion: 'V1',
  createdBy: 'Kannan P',
  createdOn: '01-Oct-2026 09:30',
  updatedBy: 'Dheena S',
  updatedOn: '02-Oct-2026 14:20',
};

const STATUS_COLOR = { Released: 'info', Completed: 'success', 'In Progress': 'success', Planned: 'warning' };
const PRIORITY_COLOR = { High: 'error', Medium: 'warning', Low: 'info' };

const COST_ELEMENTS = [
  { no: 1, element: 'Raw Material Cost', desc: 'Direct material from BOM', standard: 850.00, actual: 870.00, variance: 20.00, variancePct: 2.4 },
  { no: 2, element: 'Consumables Cost', desc: 'Cutting tools, coolant, etc.', standard: 50.00, actual: 60.00, variance: 10.00, variancePct: 20.0 },
  { no: 3, element: 'Direct Labour Cost', desc: 'Operator wages', standard: 120.00, actual: 110.00, variance: -10.00, variancePct: -8.3 },
  { no: 4, element: 'Machine Overhead Cost', desc: 'Machine running cost', standard: 100.00, actual: 95.00, variance: -5.00, variancePct: -5.0 },
  { no: 5, element: 'Fixed Overhead Cost', desc: 'Plant overhead allocation', standard: 80.00, actual: 85.00, variance: 5.00, variancePct: 6.3 },
];

const TOTAL_STANDARD = COST_ELEMENTS.reduce((sum, c) => sum + c.standard, 0);
const TOTAL_ACTUAL = COST_ELEMENTS.reduce((sum, c) => sum + c.actual, 0);
const TOTAL_VARIANCE = TOTAL_ACTUAL - TOTAL_STANDARD;
const TOTAL_VARIANCE_PCT = (TOTAL_VARIANCE / TOTAL_STANDARD) * 100;

const COST_HISTORY = [
  { no: 1, date: '01-Oct-2026', produced: 100, rawMaterial: 85000, consumables: 5000, directLabour: 12000, machineOverhead: 10000, fixedOverhead: 8000, total: 120000, perUnit: 1200.00 },
  { no: 2, date: '02-Oct-2026', produced: 120, rawMaterial: 104000, consumables: 7200, directLabour: 13200, machineOverhead: 11400, fixedOverhead: 10200, total: 146800, perUnit: 1223.33 },
  { no: 3, date: '03-Oct-2026', produced: 100, rawMaterial: 87000, consumables: 5800, directLabour: 10800, machineOverhead: 9500, fixedOverhead: 8500, total: 121600, perUnit: 1216.00 },
];

const COST_SUMMARY = [
  { label: 'Raw Material', value: 71.3, color: '#1976d2' },
  { label: 'Consumables', value: 4.9, color: '#2e7d32' },
  { label: 'Direct Labour', value: 9.0, color: '#f9a825' },
  { label: 'Machine Overhead', value: 7.8, color: '#7b1fa2' },
  { label: 'Fixed Overhead', value: 7.0, color: '#b0bec5' },
];

const TABS = ['Components', 'Operations', 'Production Execution', 'Material Issue', 'Material Receipt', 'Production History', 'Product Cost', 'Notes & Attachments'];

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function fieldRow(label, value) {
  return (
    <Grid item xs={6} sm={4} md={3} lg={2.4} key={label}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Grid>
  );
}

export default function ProductCost() {
  const [tab, setTab] = useState(6); // Product Cost tab active, matching the reference image

  const totalPerUnit = TOTAL_ACTUAL;

  const headerActions = (
    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
      <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
      <Button variant="outlined" startIcon={<ContentCopyIcon />}>Copy</Button>
      <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />}>Cancel Order</Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Production Order - View"
        subtitle="View production order details, item components, material status, operations and production progress."
        rightContent={headerActions}
      />

      {/* Production Order Details */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Production Order Details</Typography>
          <Grid container spacing={2.5}>
            {fieldRow('Production Order No.', ORDER.no)}
            {fieldRow('Order Date', ORDER.orderDate)}
            {fieldRow('Planned Start Date', ORDER.plannedStart)}
            {fieldRow('Planned End Date', ORDER.plannedEnd)}
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
              <Chip size="small" label={ORDER.status} color={STATUS_COLOR[ORDER.status] || 'default'} sx={{ mt: 0.25 }} />
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Priority</Typography>
              <Chip size="small" label={ORDER.priority} color={PRIORITY_COLOR[ORDER.priority] || 'default'} variant="outlined" sx={{ mt: 0.25 }} />
            </Grid>

            {fieldRow('Item Code', ORDER.itemCode)}
            {fieldRow('Item Description', ORDER.itemDesc)}
            {fieldRow('UOM', ORDER.uom)}
            {fieldRow('Planned Qty', numberFmt(ORDER.plannedQty))}
            {fieldRow('Produced Qty', numberFmt(ORDER.producedQty))}
            {fieldRow('Balance Qty', numberFmt(ORDER.balanceQty))}
            {fieldRow('Production Type', ORDER.productionType)}
            {fieldRow('Project', ORDER.project)}
            {fieldRow('Sales Order', ORDER.salesOrder)}

            {fieldRow('Plant / Location', ORDER.plant)}
            {fieldRow('Work Center', ORDER.workCenter)}
            {fieldRow('Routing Version', ORDER.routingVersion)}
            {fieldRow('BOM Version', ORDER.bomVersion)}
            {fieldRow('Created By', ORDER.createdBy)}
            {fieldRow('Created On', ORDER.createdOn)}
            {fieldRow('Last Updated By', ORDER.updatedBy)}
            {fieldRow('Last Updated On', ORDER.updatedOn)}
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            {TABS.map((t) => <Tab key={t} label={t} />)}
          </Tabs>
        </Box>
        <CardContent>
          {tab === 6 ? (
            <Grid container spacing={2}>
              <Grid item xs={12} lg={8.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Product Cost Details</Typography>
                  <Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />}>Recalculate Cost</Button>
                </Stack>

                <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 620px), 340px)">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>S.No</TableCell>
                        <TableCell>Cost Element</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Standard Cost (₹)</TableCell>
                        <TableCell align="right">Actual Cost (₹)</TableCell>
                        <TableCell align="right">Variance (₹)</TableCell>
                        <TableCell align="right">Variance %</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {COST_ELEMENTS.map((c) => (
                        <TableRow key={c.element} hover>
                          <TableCell>{c.no}</TableCell>
                          <TableCell>{c.element}</TableCell>
                          <TableCell>{c.desc}</TableCell>
                          <TableCell align="right">{c.standard.toFixed(2)}</TableCell>
                          <TableCell align="right">{c.actual.toFixed(2)}</TableCell>
                          <TableCell align="right">{c.variance >= 0 ? '' : '-'}{Math.abs(c.variance).toFixed(2)}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={600} color={c.variancePct >= 0 ? (c.variancePct > 10 ? 'error.main' : 'text.primary') : 'success.main'}>
                              {c.variancePct >= 0 ? '' : ''}{c.variancePct.toFixed(1)}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell />
                        <TableCell colSpan={2}><Typography variant="body2" fontWeight={700}>Total Product Cost (Per Unit)</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={700}>{TOTAL_STANDARD.toFixed(2)}</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={700}>{TOTAL_ACTUAL.toFixed(2)}</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={700}>{TOTAL_VARIANCE.toFixed(2)}</Typography></TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={700} color="error.main">{TOTAL_VARIANCE_PCT.toFixed(1)}%</Typography></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>

                {/* Product Cost History */}
                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1.5 }}>Product Cost History</Typography>
                <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 760px), 240px)">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>S.No</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Produced Qty</TableCell>
                        <TableCell align="right">Raw Material (₹)</TableCell>
                        <TableCell align="right">Consumables (₹)</TableCell>
                        <TableCell align="right">Direct Labour (₹)</TableCell>
                        <TableCell align="right">Machine Overhead (₹)</TableCell>
                        <TableCell align="right">Fixed Overhead (₹)</TableCell>
                        <TableCell align="right">Total Cost (₹)</TableCell>
                        <TableCell align="right">Cost Per Unit (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {COST_HISTORY.map((h) => (
                        <TableRow key={h.no} hover>
                          <TableCell>{h.no}</TableCell>
                          <TableCell>{h.date}</TableCell>
                          <TableCell align="right">{numberFmt(h.produced)}</TableCell>
                          <TableCell align="right">{numberFmt(h.rawMaterial)}</TableCell>
                          <TableCell align="right">{numberFmt(h.consumables)}</TableCell>
                          <TableCell align="right">{numberFmt(h.directLabour)}</TableCell>
                          <TableCell align="right">{numberFmt(h.machineOverhead)}</TableCell>
                          <TableCell align="right">{numberFmt(h.fixedOverhead)}</TableCell>
                          <TableCell align="right">{numberFmt(h.total)}</TableCell>
                          <TableCell align="right">{h.perUnit.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>
              </Grid>

              {/* Right rail */}
              <Grid item xs={12} lg={3.5}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 2 }}>Product Cost Summary</Typography>
                    <Stack alignItems="center" sx={{ mb: 2 }}>
                      <Box sx={{ position: 'relative', width: 160, height: 160 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={COST_SUMMARY} dataKey="value" nameKey="label" innerRadius={52} outerRadius={76} paddingAngle={2}>
                              {COST_SUMMARY.map((s) => <Cell key={s.label} fill={s.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <Box sx={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Typography variant="h6" fontWeight={700} color="primary.main">{money(totalPerUnit)}</Typography>
                          <Typography variant="caption" color="text.secondary">Per Unit</Typography>
                        </Box>
                      </Box>
                    </Stack>
                    <Stack spacing={0.75} sx={{ mb: 2.5 }}>
                      {COST_SUMMARY.map((s) => (
                        <Stack key={s.label} direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                          </Stack>
                          <Typography variant="caption" fontWeight={700}>{s.value}%</Typography>
                        </Stack>
                      ))}
                    </Stack>

                    <Divider sx={{ mb: 2 }} />

                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Total Standard Cost (Per Unit)</Typography>
                        <Typography variant="caption" fontWeight={700}>: {money(TOTAL_STANDARD)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Total Actual Cost (Per Unit)</Typography>
                        <Typography variant="caption" fontWeight={700}>: {money(TOTAL_ACTUAL)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Variance (Per Unit)</Typography>
                        <Typography variant="caption" fontWeight={700} color="error.main">: {money(TOTAL_VARIANCE)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Actual Cost (Total for {ORDER.producedQty} {ORDER.uom})</Typography>
                        <Typography variant="caption" fontWeight={700}>: {money(TOTAL_ACTUAL * ORDER.producedQty)}</Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No {TABS[tab].toLowerCase()} recorded for this production order yet.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Bottom action bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />}>Back to List</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<EditOutlinedIcon />}>Edit</Button>
        <Button variant="outlined" startIcon={<RocketLaunchOutlinedIcon />}>Release</Button>
        <Button variant="contained" color="success" startIcon={<CheckCircleOutlineIcon />}>Close</Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
      </Stack>
    </Box>
  );
}
