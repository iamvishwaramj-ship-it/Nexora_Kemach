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
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Order - View" screen with its
// Material Receipt tab active, built to match the reference design the
// user supplied for the Production Execution > Material Receipt submenu.
// Same convention as the other Production Execution screens (Production
// Orders, View Order, Operations, Material Requisition, Material Issue):
// there is no ProductionOrder / MaterialReceipt data model in this schema,
// so this lays out the screen exactly as designed with fixed mock data for
// one order (PO-2026-001) rather than fabricating "real" records against
// tables that don't exist. Local state only -- nothing here persists or
// calls the server; the tab strip just switches which panel label is
// active (only "Material Receipt" has mock content here, matching the
// reference image -- the other tabs show a neutral empty state, same
// pattern used on the other tabbed Production Execution pages).
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
const RECEIPT_STATUS_COLOR = { Completed: 'success', Partial: 'info' };

const TRANSACTIONS = [
  { no: 1, receiptNo: 'MR-2026-001', date: '01-Oct-2026', code: 'RM-2001', desc: 'Cast Iron', uom: 'Kg', expected: 6000, received: 6000, accepted: 6000, rejected: 0, workCenter: 'WC-01', status: 'Completed' },
  { no: 2, receiptNo: 'MR-2026-002', date: '02-Oct-2026', code: 'RM-2002', desc: 'Bearing 6205', uom: 'Nos', expected: 1000, received: 1000, accepted: 980, rejected: 20, workCenter: 'WC-01', status: 'Partial' },
  { no: 3, receiptNo: 'MR-2026-003', date: '03-Oct-2026', code: 'RM-2003', desc: 'Seal Ring', uom: 'Nos', expected: 500, received: 500, accepted: 500, rejected: 0, workCenter: 'WC-01', status: 'Completed' },
  { no: 4, receiptNo: 'MR-2026-004', date: '03-Oct-2026', code: 'RM-2004', desc: 'Gasket', uom: 'Nos', expected: 500, received: 300, accepted: 300, rejected: 0, workCenter: 'WC-01', status: 'Partial' },
  { no: 5, receiptNo: 'MR-2026-005', date: '04-Oct-2026', code: 'RM-2005', desc: 'Grease', uom: 'Kg', expected: 250, received: 250, accepted: 250, rejected: 0, workCenter: 'WC-01', status: 'Completed' },
];

const HISTORY = [
  { no: 1, dateTime: '01-Oct-2026 10:30', receiptNo: 'MR-2026-001', code: 'RM-2001', desc: 'Cast Iron', received: 6000, accepted: 6000, rejected: 0, workCenter: 'WC-01', receivedBy: 'Mani', remarks: 'Initial receipt' },
  { no: 2, dateTime: '02-Oct-2026 14:15', receiptNo: 'MR-2026-002', code: 'RM-2002', desc: 'Bearing 6205', received: 1000, accepted: 980, rejected: 20, workCenter: 'WC-01', receivedBy: 'Dheena', remarks: 'Quality rejection' },
  { no: 3, dateTime: '03-Oct-2026 09:45', receiptNo: 'MR-2026-003', code: 'RM-2003', desc: 'Seal Ring', received: 500, accepted: 500, rejected: 0, workCenter: 'WC-01', receivedBy: 'Mani', remarks: 'As per plan' },
  { no: 4, dateTime: '03-Oct-2026 16:20', receiptNo: 'MR-2026-004', code: 'RM-2004', desc: 'Gasket', received: 300, accepted: 300, rejected: 0, workCenter: 'WC-01', receivedBy: 'Arunkumar', remarks: 'Partial receipt' },
  { no: 5, dateTime: '04-Oct-2026 11:10', receiptNo: 'MR-2026-005', code: 'RM-2005', desc: 'Grease', received: 250, accepted: 250, rejected: 0, workCenter: 'WC-01', receivedBy: 'Kannan P', remarks: 'Received in good condition' },
];

const RECEIPT_SUMMARY = [
  { label: 'Received', value: 4, color: '#2e7d32' },
  { label: 'Partial', value: 1, color: '#1976d2' },
  { label: 'Pending', value: 0, color: '#b0bec5' },
];

const COMPONENT_RECEIPT_STATUS = [
  { label: 'Cast Iron', pct: 100 },
  { label: 'Bearing 6205', pct: 98 },
  { label: 'Seal Ring', pct: 100 },
  { label: 'Gasket', pct: 60 },
  { label: 'Grease', pct: 100 },
];

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

export default function MaterialReceipt() {
  const [tab, setTab] = useState(4); // Material Receipt tab active, matching the reference image
  const [checked, setChecked] = useState(() => new Set());

  const toggleRow = (receiptNo) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(receiptNo)) next.delete(receiptNo);
      else next.add(receiptNo);
      return next;
    });
  };

  const totalExpected = TRANSACTIONS.reduce((sum, t) => sum + t.expected, 0);
  const totalReceived = TRANSACTIONS.reduce((sum, t) => sum + t.received, 0);
  const totalAccepted = TRANSACTIONS.reduce((sum, t) => sum + t.accepted, 0);
  const totalRejected = TRANSACTIONS.reduce((sum, t) => sum + t.rejected, 0);
  const receiptPct = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;
  const summaryTotal = RECEIPT_SUMMARY.reduce((sum, s) => sum + s.value, 0);

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
          {tab === 4 ? (
            <Grid container spacing={2}>
              <Grid item xs={12} lg={8.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Material Receipt Transactions ({TRANSACTIONS.length})</Typography>
                  <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="contained" startIcon={<AddIcon />}>Receive Material</Button>
                    <Button size="small" variant="outlined" startIcon={<InventoryOutlinedIcon />}>View Stock</Button>
                    <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
                  </Stack>
                </Stack>

                <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 640px), 340px)">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>S.No</TableCell>
                        <TableCell>Receipt No.</TableCell>
                        <TableCell>Receipt Date</TableCell>
                        <TableCell>Component Code</TableCell>
                        <TableCell>Component Description</TableCell>
                        <TableCell>UOM</TableCell>
                        <TableCell align="right">Expected Qty</TableCell>
                        <TableCell align="right">Received Qty</TableCell>
                        <TableCell align="right">Accepted Qty</TableCell>
                        <TableCell align="right">Rejected Qty</TableCell>
                        <TableCell>Received To Work Center</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {TRANSACTIONS.map((t) => (
                        <TableRow key={t.receiptNo} hover>
                          <TableCell padding="checkbox">
                            <Checkbox size="small" checked={checked.has(t.receiptNo)} onChange={() => toggleRow(t.receiptNo)} />
                          </TableCell>
                          <TableCell>{t.no}</TableCell>
                          <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{t.receiptNo}</Typography></TableCell>
                          <TableCell>{t.date}</TableCell>
                          <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{t.code}</Typography></TableCell>
                          <TableCell>{t.desc}</TableCell>
                          <TableCell>{t.uom}</TableCell>
                          <TableCell align="right">{numberFmt(t.expected)}</TableCell>
                          <TableCell align="right">{numberFmt(t.received)}</TableCell>
                          <TableCell align="right">{numberFmt(t.accepted)}</TableCell>
                          <TableCell align="right">{numberFmt(t.rejected)}</TableCell>
                          <TableCell>{t.workCenter}</TableCell>
                          <TableCell>
                            <Chip size="small" label={t.status} color={RECEIPT_STATUS_COLOR[t.status] || 'default'} />
                          </TableCell>
                          <TableCell>
                            <Button size="small" endIcon={<KeyboardArrowDownIcon />}>View</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>

                {/* Material Receipt History */}
                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1.5 }}>Material Receipt History</Typography>
                <ScrollableTableContainer maxHeight="clamp(180px, calc(100vh - 760px), 260px)">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>S.No</TableCell>
                        <TableCell>Date &amp; Time</TableCell>
                        <TableCell>Receipt No.</TableCell>
                        <TableCell>Component Code</TableCell>
                        <TableCell>Component Description</TableCell>
                        <TableCell align="right">Received Qty</TableCell>
                        <TableCell align="right">Accepted Qty</TableCell>
                        <TableCell align="right">Rejected Qty</TableCell>
                        <TableCell>Received To</TableCell>
                        <TableCell>Received By</TableCell>
                        <TableCell>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {HISTORY.map((h) => (
                        <TableRow key={h.no} hover>
                          <TableCell>{h.no}</TableCell>
                          <TableCell>{h.dateTime}</TableCell>
                          <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{h.receiptNo}</Typography></TableCell>
                          <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{h.code}</Typography></TableCell>
                          <TableCell>{h.desc}</TableCell>
                          <TableCell align="right">{numberFmt(h.received)}</TableCell>
                          <TableCell align="right">{numberFmt(h.accepted)}</TableCell>
                          <TableCell align="right">{numberFmt(h.rejected)}</TableCell>
                          <TableCell>{h.workCenter}</TableCell>
                          <TableCell>{h.receivedBy}</TableCell>
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
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Material Receipt Summary</Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={RECEIPT_SUMMARY} dataKey="value" nameKey="label" innerRadius={30} outerRadius={46} paddingAngle={2}>
                              {RECEIPT_SUMMARY.map((s) => <Cell key={s.label} fill={s.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <Box sx={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Typography variant="body2" fontWeight={700}>{receiptPct}%</Typography>
                        </Box>
                      </Box>
                      <Stack spacing={0.5}>
                        {RECEIPT_SUMMARY.map((s) => (
                          <Stack key={s.label} direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                            <Typography variant="caption" color="text.secondary">{s.label} : {s.value}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Stack>
                    <Stack spacing={0.75} sx={{ mt: 2 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Total Expected Qty</Typography>
                        <Typography variant="caption" fontWeight={600}>{numberFmt(totalExpected)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Total Received Qty</Typography>
                        <Typography variant="caption" fontWeight={600}>{numberFmt(totalReceived)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Total Accepted Qty</Typography>
                        <Typography variant="caption" fontWeight={600}>{numberFmt(totalAccepted)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Total Rejected Qty</Typography>
                        <Typography variant="caption" fontWeight={700} color="error.main">{numberFmt(totalRejected)}</Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Component Receipt Status</Typography>
                    <Stack spacing={1.5}>
                      {COMPONENT_RECEIPT_STATUS.map((c) => (
                        <Box key={c.label}>
                          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                            <Typography variant="caption" fontWeight={700}>{c.pct}%</Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate" value={c.pct}
                            color={c.pct === 100 ? 'success' : 'info'}
                            sx={{ height: 7, borderRadius: 4 }}
                          />
                        </Box>
                      ))}
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
