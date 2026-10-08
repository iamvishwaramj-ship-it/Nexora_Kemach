import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip, Tabs, Tab, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, LinearProgress,
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import SettingsIcon from '@mui/icons-material/Settings';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AddIcon from '@mui/icons-material/Add';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import DesktopWindowsOutlinedIcon from '@mui/icons-material/DesktopWindowsOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Order - View" screen with its
// "Production Execution" tab active, built to match the reference design
// the user supplied for the Production Execution top-level menu's own
// "Production Execution" submenu (distinct from the "Operations" submenu,
// which covers the routing/operations tab instead). Same convention as the
// other Production Execution screens (Production Orders, View Order,
// Operations, Material Requisition, Material Issue, Material Receipt,
// Create Issue, Record Production, Product Cost, Production Completion):
// there is no ProductionOrder / shop-floor execution data model in this
// schema, so this lays out the screen exactly as designed with fixed mock
// data for one order (PO-2026-001) rather than fabricating "real" records
// against tables that don't exist. Local state only -- nothing here
// persists or calls the server; the tab strip just switches which panel
// label is active (only "Production Execution" has mock content here,
// matching the reference image -- the other tabs show a neutral empty
// state, same pattern used on the other tabbed Production Execution pages).
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
const EXEC_STATUS_COLOR = { Completed: 'success', 'In Progress': 'success', Planned: 'warning' };

const EXECUTIONS = [
  { no: 1, opNo: 10, desc: 'Rough Machining', workCenter: 'WC-01', planned: 500, good: 320, rework: 20, scrap: 10, total: 350, start: '01-Oct-2026 08:00', end: '02-Oct-2026 17:30', status: 'Completed' },
  { no: 2, opNo: 20, desc: 'Drilling', workCenter: 'WC-02', planned: 500, good: 200, rework: 10, scrap: 20, total: 230, start: '03-Oct-2026 08:00', end: '05-Oct-2026 16:40', status: 'In Progress' },
  { no: 3, opNo: 30, desc: 'Tapping', workCenter: 'WC-03', planned: 500, good: 0, rework: 0, scrap: 0, total: 0, start: '05-Oct-2026', end: '08-Oct-2026', status: 'Planned' },
  { no: 4, opNo: 40, desc: 'Inspection', workCenter: 'QC-01', planned: 500, good: 0, rework: 0, scrap: 0, total: 0, start: '08-Oct-2026', end: '10-Oct-2026', status: 'Planned' },
];

const HISTORY = [
  { no: 1, dateTime: '02-Oct-2026 17:30', opNo: 10, workCenter: 'WC-01', reported: 100, good: 100, rework: 0, scrap: 0, reportedBy: 'Dheena S', remarks: 'First run completed' },
  { no: 2, dateTime: '02-Oct-2026 13:15', opNo: 10, workCenter: 'WC-01', reported: 120, good: 110, rework: 10, scrap: 0, reportedBy: 'Arunkumar', remarks: 'Dimensional issue' },
  { no: 3, dateTime: '02-Oct-2026 09:45', opNo: 10, workCenter: 'WC-01', reported: 130, good: 110, rework: 10, scrap: 10, reportedBy: 'Mani', remarks: 'Over heat issue' },
  { no: 4, dateTime: '01-Oct-2026 16:20', opNo: 10, workCenter: 'WC-01', reported: 70, good: 0, rework: 0, scrap: 0, reportedBy: 'Kannan P', remarks: 'Trial run' },
];

const OPERATION_PROGRESS = [
  { label: 'Rough Machining', pct: 100 },
  { label: 'Drilling', pct: 46 },
  { label: 'Tapping', pct: 0 },
  { label: 'Inspection', pct: 0 },
];

const MATERIAL_CONSUMPTION = [
  { no: 1, code: 'RM-2001', required: 6000, issued: 5200, balance: 800 },
  { no: 2, code: 'RM-2002', required: 1000, issued: 800, balance: 200 },
  { no: 3, code: 'RM-2003', required: 500, issued: 500, balance: 0 },
  { no: 4, code: 'RM-2004', required: 500, issued: 300, balance: 200 },
  { no: 5, code: 'RM-2005', required: 250, issued: 100, balance: 150 },
];

const EXECUTION_SUMMARY = {
  plannedQty: 500, producedQty: 320, reworkQty: 30, scrapQty: 30, balanceQty: 180,
};

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

export default function ProductionExecutionStatus() {
  const [tab, setTab] = useState(2); // Production Execution tab active, matching the reference image
  const [checked, setChecked] = useState(() => new Set());

  const toggleRow = (opNo) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(opNo)) next.delete(opNo);
      else next.add(opNo);
      return next;
    });
  };

  const progressPct = EXECUTION_SUMMARY.plannedQty > 0
    ? Math.round((EXECUTION_SUMMARY.producedQty / EXECUTION_SUMMARY.plannedQty) * 100)
    : 0;

  const DONUT_DATA = [
    { label: 'Produced', value: EXECUTION_SUMMARY.producedQty, color: '#2e7d32' },
    { label: 'Rework', value: EXECUTION_SUMMARY.reworkQty, color: '#f9a825' },
    { label: 'Scrap', value: EXECUTION_SUMMARY.scrapQty, color: '#d32f2f' },
    { label: 'Balance', value: EXECUTION_SUMMARY.balanceQty - EXECUTION_SUMMARY.reworkQty - EXECUTION_SUMMARY.scrapQty, color: '#e0e0e0' },
  ];

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
          {tab === 2 ? (
            <Grid container spacing={2}>
              <Grid item xs={12} lg={8.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Production Execution ({EXECUTIONS.length})</Typography>
                  <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="contained" startIcon={<AddIcon />}>Report Production</Button>
                    <Button size="small" variant="outlined" startIcon={<PauseCircleOutlineIcon />}>Pause Operation</Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<BlockOutlinedIcon />}>Hold Order</Button>
                    <Button size="small" variant="outlined" startIcon={<DesktopWindowsOutlinedIcon />}>View Shop Floor</Button>
                  </Stack>
                </Stack>

                <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 640px), 340px)">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>S.No</TableCell>
                        <TableCell>Operation No.</TableCell>
                        <TableCell>Operation Description</TableCell>
                        <TableCell>Work Center</TableCell>
                        <TableCell align="right">Planned Qty</TableCell>
                        <TableCell align="right">Good Qty</TableCell>
                        <TableCell align="right">Rework Qty</TableCell>
                        <TableCell align="right">Scrap Qty</TableCell>
                        <TableCell align="right">Total Qty</TableCell>
                        <TableCell>Start Date</TableCell>
                        <TableCell>End Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {EXECUTIONS.map((e) => (
                        <TableRow key={e.opNo} hover>
                          <TableCell padding="checkbox">
                            <Checkbox size="small" checked={checked.has(e.opNo)} onChange={() => toggleRow(e.opNo)} />
                          </TableCell>
                          <TableCell>{e.no}</TableCell>
                          <TableCell>{e.opNo}</TableCell>
                          <TableCell>{e.desc}</TableCell>
                          <TableCell>{e.workCenter}</TableCell>
                          <TableCell align="right">{numberFmt(e.planned)}</TableCell>
                          <TableCell align="right">{numberFmt(e.good)}</TableCell>
                          <TableCell align="right">{numberFmt(e.rework)}</TableCell>
                          <TableCell align="right">{numberFmt(e.scrap)}</TableCell>
                          <TableCell align="right">{numberFmt(e.total)}</TableCell>
                          <TableCell>{e.start}</TableCell>
                          <TableCell>{e.end}</TableCell>
                          <TableCell>
                            <Chip size="small" label={e.status} color={EXEC_STATUS_COLOR[e.status] || 'default'} />
                          </TableCell>
                          <TableCell>
                            <Button size="small" endIcon={<KeyboardArrowDownIcon />}>View</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>

                {/* Production Execution History */}
                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1.5 }}>Production Execution History</Typography>
                <ScrollableTableContainer maxHeight="clamp(180px, calc(100vh - 760px), 260px)">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>S.No</TableCell>
                        <TableCell>Date &amp; Time</TableCell>
                        <TableCell>Operation No.</TableCell>
                        <TableCell>Work Center</TableCell>
                        <TableCell align="right">Reported Qty</TableCell>
                        <TableCell align="right">Good Qty</TableCell>
                        <TableCell align="right">Rework Qty</TableCell>
                        <TableCell align="right">Scrap Qty</TableCell>
                        <TableCell>Reported By</TableCell>
                        <TableCell>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {HISTORY.map((h) => (
                        <TableRow key={h.no} hover>
                          <TableCell>{h.no}</TableCell>
                          <TableCell>{h.dateTime}</TableCell>
                          <TableCell>{h.opNo}</TableCell>
                          <TableCell>{h.workCenter}</TableCell>
                          <TableCell align="right">{numberFmt(h.reported)}</TableCell>
                          <TableCell align="right">{numberFmt(h.good)}</TableCell>
                          <TableCell align="right">{numberFmt(h.rework)}</TableCell>
                          <TableCell align="right">{numberFmt(h.scrap)}</TableCell>
                          <TableCell>{h.reportedBy}</TableCell>
                          <TableCell>{h.remarks}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>
              </Grid>

              {/* Right rail */}
              <Grid item xs={12} lg={3.5}>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Execution Summary</Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={DONUT_DATA} dataKey="value" nameKey="label" innerRadius={34} outerRadius={52} paddingAngle={2}>
                              {DONUT_DATA.map((s) => <Cell key={s.label} fill={s.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <Box sx={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Typography variant="body2" fontWeight={700}>{progressPct}%</Typography>
                        </Box>
                      </Box>
                      <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                          <Typography variant="caption" color="text.secondary">Planned Qty</Typography>
                          <Typography variant="caption" fontWeight={700}>: {numberFmt(EXECUTION_SUMMARY.plannedQty)}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                          <Typography variant="caption" color="text.secondary">Produced Qty</Typography>
                          <Typography variant="caption" fontWeight={700}>: {numberFmt(EXECUTION_SUMMARY.producedQty)}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                          <Typography variant="caption" color="text.secondary">Rework Qty</Typography>
                          <Typography variant="caption" fontWeight={700}>: {numberFmt(EXECUTION_SUMMARY.reworkQty)}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                          <Typography variant="caption" color="text.secondary">Scrap Qty</Typography>
                          <Typography variant="caption" fontWeight={700}>: {numberFmt(EXECUTION_SUMMARY.scrapQty)}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                          <Typography variant="caption" color="text.secondary">Balance Qty</Typography>
                          <Typography variant="caption" fontWeight={700}>: {numberFmt(EXECUTION_SUMMARY.balanceQty)}</Typography>
                        </Stack>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Operation Wise Progress</Typography>
                    <Stack spacing={1.5}>
                      {OPERATION_PROGRESS.map((o) => (
                        <Box key={o.label}>
                          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">{o.label}</Typography>
                            <Typography variant="caption" fontWeight={700}>{o.pct}%</Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate" value={o.pct}
                            color={o.pct === 100 ? 'success' : o.pct > 0 ? 'info' : 'inherit'}
                            sx={{ height: 7, borderRadius: 4 }}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Material Consumption</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ px: 0.5 }}>S.No</TableCell>
                          <TableCell sx={{ px: 0.5 }}>Component Code</TableCell>
                          <TableCell sx={{ px: 0.5 }} align="right">Required Qty</TableCell>
                          <TableCell sx={{ px: 0.5 }} align="right">Issued Qty</TableCell>
                          <TableCell sx={{ px: 0.5 }} align="right">Balance Qty</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {MATERIAL_CONSUMPTION.map((m) => (
                          <TableRow key={m.code}>
                            <TableCell sx={{ px: 0.5 }}>{m.no}</TableCell>
                            <TableCell sx={{ px: 0.5 }}><Typography variant="caption" color="primary.main" fontWeight={600}>{m.code}</Typography></TableCell>
                            <TableCell sx={{ px: 0.5 }} align="right"><Typography variant="caption">{numberFmt(m.required)}</Typography></TableCell>
                            <TableCell sx={{ px: 0.5 }} align="right"><Typography variant="caption">{numberFmt(m.issued)}</Typography></TableCell>
                            <TableCell sx={{ px: 0.5 }} align="right"><Typography variant="caption">{numberFmt(m.balance)}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Button
                      fullWidth variant="outlined" startIcon={<OutboxOutlinedIcon />}
                      sx={{ mt: 1.5 }}
                    >
                      View Material Issue
                    </Button>
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
