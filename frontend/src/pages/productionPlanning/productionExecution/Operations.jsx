import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip, Tabs, Tab, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, LinearProgress, Divider,
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SettingsIcon from '@mui/icons-material/Settings';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AddIcon from '@mui/icons-material/Add';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Order - View" screen with its
// Operations tab active, built to match the reference design the user
// supplied for the Production Execution > Operations submenu. Same
// convention as the other Production Execution screens (Production Orders,
// View Order, ...): there is no ProductionOrder / Routing / Operation data
// model in this schema, so this lays out the screen exactly as designed
// with fixed mock data for one order (PO-2026-001) rather than fabricating
// "real" records against tables that don't exist. Local state only --
// nothing here persists or calls the server; the tab strip just switches
// which panel label is active (only "Operations" has mock content here,
// matching the reference image -- the other tabs show a neutral empty
// state, same pattern used on the View Order page).
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
const OP_STATUS_COLOR = { Completed: 'success', 'In Progress': 'success', Planned: 'warning' };

const OPERATIONS = [
  { no: 1, opNo: 10, desc: 'Rough Machining', workCenter: 'WC-01', setup: 60, run: 12, planned: 500, completed: 320, inProgress: 100, pending: 80, start: '01-Oct-2026', end: '03-Oct-2026', status: 'Completed' },
  { no: 2, opNo: 20, desc: 'Drilling', workCenter: 'WC-02', setup: 30, run: 8, planned: 500, completed: 200, inProgress: 180, pending: 120, start: '03-Oct-2026', end: '05-Oct-2026', status: 'In Progress' },
  { no: 3, opNo: 30, desc: 'Tapping', workCenter: 'WC-03', setup: 20, run: 5, planned: 500, completed: 0, inProgress: 0, pending: 500, start: '05-Oct-2026', end: '08-Oct-2026', status: 'Planned' },
  { no: 4, opNo: 40, desc: 'Inspection', workCenter: 'QC-01', setup: 15, run: 3, planned: 500, completed: 0, inProgress: 0, pending: 500, start: '08-Oct-2026', end: '10-Oct-2026', status: 'Planned' },
];

const SEQUENCE_META = {
  Completed: { icon: CheckCircleIcon, color: 'success.main', bg: 'success.lighter', border: 'success.light' },
  'In Progress': { icon: PlayCircleOutlineIcon, color: 'info.main', bg: 'info.lighter', border: 'info.light' },
  Planned: { icon: ScheduleOutlinedIcon, color: 'text.secondary', bg: 'action.hover', border: 'divider' },
};

const CHART_DATA = OPERATIONS.map((o) => ({ name: o.desc, Completed: o.completed, 'In Progress': o.inProgress, Pending: o.pending }));

const TABS = ['Components', 'Operations', 'Production Execution', 'Material Issue', 'Material Receipt', 'Production History', 'Notes & Attachments'];

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

function detailRow(label, value) {
  return (
    <Stack key={label} direction="row" justifyContent="space-between">
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" fontWeight={600}>{value}</Typography>
    </Stack>
  );
}

export default function Operations() {
  const [tab, setTab] = useState(1); // Operations tab active, matching the reference image
  const [checked, setChecked] = useState(() => new Set());
  const [selectedOp, setSelectedOp] = useState(10);

  const toggleRow = (opNo) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(opNo)) next.delete(opNo);
      else next.add(opNo);
      return next;
    });
  };

  const selected = OPERATIONS.find((o) => o.opNo === selectedOp) || OPERATIONS[0];
  const progressPct = ORDER.plannedQty > 0 ? Math.round((ORDER.producedQty / ORDER.plannedQty) * 100) : 0;

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
        subtitle="View production order details, item components, routing operations, material status, operations and production progress."
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
          {tab === 1 ? (
            <Grid container spacing={2}>
              <Grid item xs={12} lg={8.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Operations ({OPERATIONS.length})</Typography>
                  <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="contained" startIcon={<AddIcon />}>Add Operation</Button>
                    <Button size="small" variant="outlined" startIcon={<SwapVertOutlinedIcon />}>Re-sequence</Button>
                    <Button size="small" variant="outlined" startIcon={<RouteOutlinedIcon />}>View Routing</Button>
                    <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
                  </Stack>
                </Stack>

                <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 640px), 380px)">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>S.No</TableCell>
                        <TableCell>Operation No.</TableCell>
                        <TableCell>Operation Description</TableCell>
                        <TableCell>Work Center</TableCell>
                        <TableCell align="right">Setup Time (Min)</TableCell>
                        <TableCell align="right">Run Time (Min/Unit)</TableCell>
                        <TableCell align="right">Planned Qty</TableCell>
                        <TableCell align="right">Completed Qty</TableCell>
                        <TableCell align="right">In Progress Qty</TableCell>
                        <TableCell align="right">Pending Qty</TableCell>
                        <TableCell>Start Date</TableCell>
                        <TableCell>End Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {OPERATIONS.map((o) => (
                        <TableRow
                          key={o.opNo} hover selected={selectedOp === o.opNo}
                          onClick={() => setSelectedOp(o.opNo)} sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox size="small" checked={checked.has(o.opNo)} onClick={(e) => e.stopPropagation()} onChange={() => toggleRow(o.opNo)} />
                          </TableCell>
                          <TableCell>{o.no}</TableCell>
                          <TableCell>{o.opNo}</TableCell>
                          <TableCell>{o.desc}</TableCell>
                          <TableCell>{o.workCenter}</TableCell>
                          <TableCell align="right">{o.setup}</TableCell>
                          <TableCell align="right">{o.run}</TableCell>
                          <TableCell align="right">{numberFmt(o.planned)}</TableCell>
                          <TableCell align="right">{numberFmt(o.completed)}</TableCell>
                          <TableCell align="right">{numberFmt(o.inProgress)}</TableCell>
                          <TableCell align="right">{numberFmt(o.pending)}</TableCell>
                          <TableCell>{o.start}</TableCell>
                          <TableCell>{o.end}</TableCell>
                          <TableCell>
                            <Chip size="small" label={o.status} color={OP_STATUS_COLOR[o.status] || 'default'} />
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelectedOp(o.opNo); }}>
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>

                {/* Operations Progress + Operation Sequence */}
                <Grid container spacing={2} sx={{ mt: 0.5 }}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Operations Progress</Typography>
                        <Box sx={{ width: '100%', height: 260 }}>
                          <ResponsiveContainer>
                            <BarChart data={CHART_DATA} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Bar dataKey="Completed" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="In Progress" fill="#1976d2" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Pending" fill="#f57c00" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                        <Stack direction="row" spacing={2.5} justifyContent="center" sx={{ mt: 1 }}>
                          {[['Completed', 'success.main'], ['In Progress', 'info.main'], ['Pending', 'warning.main']].map(([label, color]) => (
                            <Stack key={label} direction="row" spacing={0.75} alignItems="center">
                              <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: color }} />
                              <Typography variant="caption" color="text.secondary">{label}</Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Operation Sequence</Typography>
                        <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
                          {OPERATIONS.map((o, idx) => {
                            const meta = SEQUENCE_META[o.status] || SEQUENCE_META.Planned;
                            const Icon = meta.icon;
                            return (
                              <React.Fragment key={o.opNo}>
                                <Box
                                  onClick={() => setSelectedOp(o.opNo)}
                                  sx={{
                                    cursor: 'pointer', textAlign: 'center', borderRadius: 2, p: 1.5, minWidth: 92,
                                    bgcolor: meta.bg, border: '1px solid', borderColor: selectedOp === o.opNo ? meta.color : meta.border,
                                  }}
                                >
                                  <Typography variant="h6" fontWeight={700} color={meta.color}>{o.opNo}</Typography>
                                  <Typography variant="caption" display="block" fontWeight={600}>{o.desc}</Typography>
                                  <Typography variant="caption" display="block" color="text.secondary">{o.workCenter}</Typography>
                                  <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" sx={{ mt: 0.5 }}>
                                    <Icon sx={{ fontSize: 14, color: meta.color }} />
                                    <Typography variant="caption" color={meta.color} fontWeight={600}>{o.status}</Typography>
                                  </Stack>
                                </Box>
                                {idx < OPERATIONS.length - 1 && <ArrowForwardIcon sx={{ color: 'text.disabled' }} />}
                              </React.Fragment>
                            );
                          })}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Grid>

              {/* Right rail: Operation Details / Progress / Work Center Capacity */}
              <Grid item xs={12} lg={3.5}>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Operation Details</Typography>
                    <Stack spacing={1}>
                      {detailRow('Operation No.', selected.opNo)}
                      {detailRow('Operation Desc.', selected.desc)}
                      {detailRow('Work Center', selected.workCenter)}
                      {detailRow('Setup Time', `${selected.setup} Min`)}
                      {detailRow('Run Time', `${selected.run} Min/Unit`)}
                      {detailRow('Planned Qty', `${numberFmt(selected.planned)} Nos`)}
                      {detailRow('Completed Qty', `${numberFmt(selected.completed)} Nos`)}
                      {detailRow('In Progress Qty', `${numberFmt(selected.inProgress)} Nos`)}
                      {detailRow('Pending Qty', `${numberFmt(selected.pending)} Nos`)}
                      {detailRow('Start Date', selected.start)}
                      {detailRow('End Date', selected.end)}
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary">Status</Typography>
                        <Chip size="small" label={selected.status} color={OP_STATUS_COLOR[selected.status] || 'default'} />
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={700}>Progress</Typography>
                      <Typography variant="body2" fontWeight={700} color="success.main">{progressPct}%</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={progressPct} color="success" sx={{ height: 8, borderRadius: 4, mb: 1.5 }} />
                    <Stack spacing={0.75}>
                      {detailRow('Planned Qty', numberFmt(ORDER.plannedQty))}
                      {detailRow('Completed Qty', numberFmt(ORDER.producedQty))}
                      {detailRow('In Progress Qty', numberFmt(selected.inProgress))}
                      {detailRow('Pending Qty', numberFmt(ORDER.balanceQty))}
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Work Center Capacity</Typography>
                    <Stack spacing={0.75}>
                      {detailRow('Available (Today)', '480 Min')}
                      {detailRow('Planned', '420 Min')}
                      {detailRow('Actual', '380 Min')}
                      <Divider sx={{ my: 0.5 }} />
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Variance</Typography>
                        <Typography variant="caption" fontWeight={700} color="error.main">-40 Min</Typography>
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
        <Button variant="outlined" startIcon={<EditOutlinedIcon />}>Edit Operation</Button>
        <Button variant="contained" color="success" startIcon={<CheckCircleOutlineIcon />}>Close</Button>
      </Stack>
    </Box>
  );
}
