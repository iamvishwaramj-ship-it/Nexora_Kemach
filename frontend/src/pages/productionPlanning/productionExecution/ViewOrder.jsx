import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, Button, Chip, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell, Divider, CircularProgress, Link as MuiLink,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Order - View" screen, built to
// match the reference design the user supplied. Same convention as the
// other Production Execution / Production Planning screens already built
// this way (Production Orders list, Generate Order - MRP, etc.): there is
// no ProductionOrder / BOM / Routing / Operations data model in this
// schema, so this lays out the screen exactly as designed with fixed mock
// data for one order (PO-2026-001) rather than fabricating "real" records
// against tables that don't exist. Local state only -- nothing here
// persists or calls the server; the tab strip just switches which mock
// panel is shown.
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

const COMPONENT_STATUS_COLOR = { Issued: 'success', Partial: 'info', Pending: 'warning' };

const COMPONENTS = [
  { no: 1, code: 'RM-2001', desc: 'Cast Iron', uom: 'Kg', bomQty: '12.000', totalReq: 6000, issued: 5200, pending: 800, status: 'Issued' },
  { no: 2, code: 'RM-2002', desc: 'Bearing 6205', uom: 'Nos', bomQty: '2.000', totalReq: 1000, issued: 800, pending: 200, status: 'Partial' },
  { no: 3, code: 'RM-2003', desc: 'Seal Ring', uom: 'Nos', bomQty: '1.000', totalReq: 500, issued: 500, pending: 0, status: 'Issued' },
  { no: 4, code: 'RM-2004', desc: 'Gasket', uom: 'Nos', bomQty: '1.000', totalReq: 500, issued: 300, pending: 200, status: 'Partial' },
  { no: 5, code: 'RM-2005', desc: 'Grease', uom: 'Kg', bomQty: '0.500', totalReq: 250, issued: 100, pending: 150, status: 'Pending' },
];

const TABS = ['Components', 'Operations', 'Production Execution', 'Material Issue', 'Material Receipt', 'Production History', 'Notes & Attachments'];

const MATERIAL_STATUS = { issued: 4, partial: 1, pending: 0, notRequired: 0 };

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

export default function ViewOrder() {
  const [tab, setTab] = useState(0);

  const progressPct = ORDER.plannedQty > 0 ? Math.round((ORDER.producedQty / ORDER.plannedQty) * 100) : 0;
  const materialTotal = MATERIAL_STATUS.issued + MATERIAL_STATUS.partial + MATERIAL_STATUS.pending + MATERIAL_STATUS.notRequired;
  const materialPct = materialTotal > 0 ? Math.round((MATERIAL_STATUS.issued / materialTotal) * 100) : 0;

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

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8.5}>
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
          <Card variant="outlined">
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}>
              <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
                {TABS.map((t) => <Tab key={t} label={t} />)}
              </Tabs>
            </Box>
            <CardContent>
              {tab === 0 && (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>BOM Components ({COMPONENTS.length})</Typography>
                    <Stack direction="row" spacing={1.25}>
                      <Button size="small" variant="outlined" startIcon={<SyncOutlinedIcon />}>Check Availability</Button>
                      <Button size="small" variant="outlined" startIcon={<BookmarkAddOutlinedIcon />}>Reserve Material</Button>
                      <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon />}>View BOM</Button>
                    </Stack>
                  </Stack>
                  <ScrollableTableContainer maxHeight="clamp(240px, calc(100vh - 560px), 420px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>S.No</TableCell>
                          <TableCell>Component Code</TableCell>
                          <TableCell>Component Description</TableCell>
                          <TableCell>UOM</TableCell>
                          <TableCell align="right">BOM Qty per Unit</TableCell>
                          <TableCell align="right">Total Required Qty</TableCell>
                          <TableCell align="right">Issued Qty</TableCell>
                          <TableCell align="right">Pending Qty</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {COMPONENTS.map((c) => (
                          <TableRow key={c.code} hover>
                            <TableCell>{c.no}</TableCell>
                            <TableCell><MuiLink underline="hover" fontWeight={600}>{c.code}</MuiLink></TableCell>
                            <TableCell>{c.desc}</TableCell>
                            <TableCell>{c.uom}</TableCell>
                            <TableCell align="right">{c.bomQty}</TableCell>
                            <TableCell align="right">{numberFmt(c.totalReq)}</TableCell>
                            <TableCell align="right">{numberFmt(c.issued)}</TableCell>
                            <TableCell align="right">{numberFmt(c.pending)}</TableCell>
                            <TableCell>
                              <Chip size="small" label={c.status} color={COMPONENT_STATUS_COLOR[c.status] || 'default'} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </>
              )}

              {tab !== 0 && (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No {TABS[tab].toLowerCase()} recorded for this production order yet.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right rail */}
        <Grid item xs={12} lg={3.5}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Production Progress</Typography>
              <Stack alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress variant="determinate" value={progressPct} size={120} thickness={5} color="success" />
                  <Box sx={{
                    top: 0, left: 0, bottom: 0, right: 0, position: 'absolute',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography variant="h6" fontWeight={700}>{progressPct}%</Typography>
                  </Box>
                </Box>
              </Stack>
              <Stack spacing={0.75}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Planned Qty</Typography>
                  <Typography variant="caption" fontWeight={600}>{numberFmt(ORDER.plannedQty)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Produced Qty</Typography>
                  <Typography variant="caption" fontWeight={600}>{numberFmt(ORDER.producedQty)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Balance Qty</Typography>
                  <Typography variant="caption" fontWeight={600}>{numberFmt(ORDER.balanceQty)}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Material Status</Typography>
              <Stack direction="row" spacing={2.5} alignItems="center">
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress variant="determinate" value={materialPct} size={72} thickness={5} color="success" />
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
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'info.main' }} />
                    <Typography variant="caption" color="text.secondary">Partial : {MATERIAL_STATUS.partial}</Typography>
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
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Production Order Summary</Typography>
              <Stack spacing={1}>
                {[
                  { label: 'Total Components', value: COMPONENTS.length },
                  { label: 'Operations', value: 4 },
                  { label: 'Material Issue', value: 6 },
                  { label: 'Material Receipt', value: 3 },
                  { label: 'Rework Qty', value: 0 },
                  { label: 'Scrap Qty', value: 5 },
                ].map((row) => (
                  <Stack key={row.label} direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">{row.label}</Typography>
                    <Typography variant="caption" fontWeight={600}>{row.value}</Typography>
                  </Stack>
                ))}
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={700}>Completion %</Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">{progressPct}%</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom action bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
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
