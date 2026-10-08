import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip, Tabs, Tab, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, LinearProgress,
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import SettingsIcon from '@mui/icons-material/Settings';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AddIcon from '@mui/icons-material/Add';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Order - View" screen with its
// Material Issue tab active, built to match the reference design the user
// supplied for the Production Execution > Material Issue submenu. Same
// convention as the other Production Execution screens (Production Orders,
// View Order, Operations, Material Requisition): there is no
// ProductionOrder / MaterialIssue data model in this schema, so this lays
// out the screen exactly as designed with fixed mock data for one order
// (PO-2026-001) rather than fabricating "real" records against tables that
// don't exist. Local state only -- nothing here persists or calls the
// server; the tab strip just switches which panel label is active (only
// "Material Issue" has mock content here, matching the reference image --
// the other tabs show a neutral empty state, same pattern used on the View
// Order / Operations pages).
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
const ISSUE_STATUS_COLOR = { Issued: 'success', 'Partially Issued': 'warning' };

const TRANSACTIONS = [
  { no: 1, issueNo: 'MI-2026-001', date: '01-Oct-2026', code: 'RM-2001', desc: 'Cast Iron', uom: 'Kg', required: 6000, issued: 5200, balance: 800, workCenter: 'WC-01', status: 'Issued' },
  { no: 2, issueNo: 'MI-2026-002', date: '01-Oct-2026', code: 'RM-2002', desc: 'Bearing 6205', uom: 'Nos', required: 1000, issued: 800, balance: 200, workCenter: 'WC-01', status: 'Partially Issued' },
  { no: 3, issueNo: 'MI-2026-003', date: '02-Oct-2026', code: 'RM-2003', desc: 'Seal Ring', uom: 'Nos', required: 500, issued: 500, balance: 0, workCenter: 'WC-01', status: 'Issued' },
  { no: 4, issueNo: 'MI-2026-004', date: '02-Oct-2026', code: 'RM-2004', desc: 'Gasket', uom: 'Nos', required: 500, issued: 300, balance: 200, workCenter: 'WC-01', status: 'Partially Issued' },
  { no: 5, issueNo: 'MI-2026-005', date: '03-Oct-2026', code: 'RM-2005', desc: 'Grease', uom: 'Kg', required: 250, issued: 100, balance: 150, workCenter: 'WC-01', status: 'Partially Issued' },
  { no: 6, issueNo: 'MI-2026-006', date: '03-Oct-2026', code: 'RM-2006', desc: 'Bolt M12', uom: 'Nos', required: 2000, issued: 2000, balance: 0, workCenter: 'WC-01', status: 'Issued' },
];

const HISTORY = [
  { no: 1, issueNo: 'MI-2026-001', dateTime: '01-Oct-2026 10:15', code: 'RM-2001', desc: 'Cast Iron', uom: 'Kg', issued: 5200, workCenter: 'WC-01', issuedBy: 'Mani', remarks: 'Initial issue' },
  { no: 2, issueNo: 'MI-2026-001', dateTime: '01-Oct-2026 10:15', code: 'RM-2002', desc: 'Bearing 6205', uom: 'Nos', issued: 800, workCenter: 'WC-01', issuedBy: 'Mani', remarks: 'Initial issue' },
  { no: 3, issueNo: 'MI-2026-003', dateTime: '02-Oct-2026 11:20', code: 'RM-2003', desc: 'Seal Ring', uom: 'Nos', issued: 500, workCenter: 'WC-01', issuedBy: 'Dheena', remarks: 'Issued as per plan' },
  { no: 4, issueNo: 'MI-2026-004', dateTime: '02-Oct-2026 14:10', code: 'RM-2004', desc: 'Gasket', uom: 'Nos', issued: 300, workCenter: 'WC-01', issuedBy: 'Dheena', remarks: 'Partial issue' },
];

const PENDING = [
  { no: 1, code: 'RM-2001', desc: 'Cast Iron', pending: 800 },
  { no: 2, code: 'RM-2002', desc: 'Bearing 6205', pending: 200 },
  { no: 3, code: 'RM-2004', desc: 'Gasket', pending: 200 },
  { no: 4, code: 'RM-2005', desc: 'Grease', pending: 150 },
];

const ISSUE_SUMMARY = [
  { label: 'Issued', value: 5, color: '#2e7d32' },
  { label: 'Partially Issued', value: 3, color: '#f9a825' },
  { label: 'Pending', value: 2, color: '#b0bec5' },
];

const TABS = ['Components', 'Operations', 'Production Execution', 'Material Issue', 'Material Receipt', 'Production History', 'Notes & Attachments'];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function MaterialIssue() {
  const [tab, setTab] = useState(3); // Material Issue tab active, matching the reference image
  const [checked, setChecked] = useState(() => new Set());

  const toggleRow = (issueNo) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(issueNo)) next.delete(issueNo);
      else next.add(issueNo);
      return next;
    });
  };

  const totalRequired = 10250;
  const totalIssued = 8000;
  const balanceQty = 2250;
  const materialPct = Math.round((totalIssued / totalRequired) * 100);
  const issueSummaryTotal = ISSUE_SUMMARY.reduce((sum, s) => sum + s.value, 0);

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
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Production Order No.</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.no}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Order Date</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.orderDate}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Planned Start Date</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.plannedStart}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Planned End Date</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.plannedEnd}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
              <Chip size="small" label={ORDER.status} color={STATUS_COLOR[ORDER.status] || 'default'} sx={{ mt: 0.25 }} />
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Priority</Typography>
              <Chip size="small" label={ORDER.priority} color={PRIORITY_COLOR[ORDER.priority] || 'default'} variant="outlined" sx={{ mt: 0.25 }} />
            </Grid>

            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Item Code</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.itemCode}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Item Description</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.itemDesc}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">UOM</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.uom}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Planned Qty</Typography>
              <Typography variant="body2" fontWeight={600}>{numberFmt(ORDER.plannedQty)}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Produced Qty</Typography>
              <Typography variant="body2" fontWeight={600}>{numberFmt(ORDER.producedQty)}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Balance Qty</Typography>
              <Typography variant="body2" fontWeight={600}>{numberFmt(ORDER.balanceQty)}</Typography>
            </Grid>

            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Production Type</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.productionType}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Project</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.project}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Sales Order</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.salesOrder}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Plant / Location</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.plant}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Work Center</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.workCenter}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Routing Version</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.routingVersion}</Typography>
            </Grid>

            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">BOM Version</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.bomVersion}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Created By</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.createdBy}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Created On</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.createdOn}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Last Updated By</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.updatedBy}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={3} lg={2.4}>
              <Typography variant="caption" color="text.secondary" display="block">Last Updated On</Typography>
              <Typography variant="body2" fontWeight={600}>{ORDER.updatedOn}</Typography>
            </Grid>
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
          {tab === 3 ? (
            <Grid container spacing={2}>
              <Grid item xs={12} lg={8.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>Material Issue Transactions ({TRANSACTIONS.length})</Typography>
                  <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="contained" startIcon={<AddIcon />}>Issue Material</Button>
                    <Button size="small" variant="outlined" startIcon={<UndoOutlinedIcon />}>Return Material</Button>
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
                        <TableCell>Issue No.</TableCell>
                        <TableCell>Issue Date</TableCell>
                        <TableCell>Component Code</TableCell>
                        <TableCell>Component Description</TableCell>
                        <TableCell>UOM</TableCell>
                        <TableCell align="right">Required Qty</TableCell>
                        <TableCell align="right">Issued Qty</TableCell>
                        <TableCell align="right">Balance Qty</TableCell>
                        <TableCell>Issued To Work Center</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {TRANSACTIONS.map((t) => (
                        <TableRow key={t.issueNo + t.code} hover>
                          <TableCell padding="checkbox">
                            <Checkbox size="small" checked={checked.has(t.issueNo)} onChange={() => toggleRow(t.issueNo)} />
                          </TableCell>
                          <TableCell>{t.no}</TableCell>
                          <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{t.issueNo}</Typography></TableCell>
                          <TableCell>{t.date}</TableCell>
                          <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{t.code}</Typography></TableCell>
                          <TableCell>{t.desc}</TableCell>
                          <TableCell>{t.uom}</TableCell>
                          <TableCell align="right">{numberFmt(t.required)}</TableCell>
                          <TableCell align="right">{numberFmt(t.issued)}</TableCell>
                          <TableCell align="right">{numberFmt(t.balance)}</TableCell>
                          <TableCell>{t.workCenter}</TableCell>
                          <TableCell>
                            <Chip size="small" label={t.status} color={ISSUE_STATUS_COLOR[t.status] || 'default'} />
                          </TableCell>
                          <TableCell>
                            <Button size="small" endIcon={<KeyboardArrowDownIcon />}>View</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>

                {/* Material Issue History */}
                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1.5 }}>Material Issue History</Typography>
                <ScrollableTableContainer maxHeight="clamp(180px, calc(100vh - 760px), 260px)">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>S.No</TableCell>
                        <TableCell>Issue No.</TableCell>
                        <TableCell>Issue Date &amp; Time</TableCell>
                        <TableCell>Component Code</TableCell>
                        <TableCell>Component Description</TableCell>
                        <TableCell>UOM</TableCell>
                        <TableCell align="right">Issued Qty</TableCell>
                        <TableCell>Work Center</TableCell>
                        <TableCell>Issued By</TableCell>
                        <TableCell>Remarks</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {HISTORY.map((h) => (
                        <TableRow key={h.no} hover>
                          <TableCell>{h.no}</TableCell>
                          <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{h.issueNo}</Typography></TableCell>
                          <TableCell>{h.dateTime}</TableCell>
                          <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{h.code}</Typography></TableCell>
                          <TableCell>{h.desc}</TableCell>
                          <TableCell>{h.uom}</TableCell>
                          <TableCell align="right">{numberFmt(h.issued)}</TableCell>
                          <TableCell>{h.workCenter}</TableCell>
                          <TableCell>{h.issuedBy}</TableCell>
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
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Material Issue Summary</Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={ISSUE_SUMMARY} dataKey="value" nameKey="label" innerRadius={30} outerRadius={46} paddingAngle={2}>
                              {ISSUE_SUMMARY.map((s) => <Cell key={s.label} fill={s.color} />)}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <Box sx={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Typography variant="body2" fontWeight={700}>{Math.round((ISSUE_SUMMARY[0].value / issueSummaryTotal) * 100)}%</Typography>
                        </Box>
                      </Box>
                      <Stack spacing={0.5}>
                        {ISSUE_SUMMARY.map((s) => (
                          <Stack key={s.label} direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                            <Typography variant="caption" color="text.secondary">{s.label} : {s.value}</Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight={700}>Material Issue Progress</Typography>
                      <Typography variant="body2" fontWeight={700} color="success.main">{materialPct}%</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={materialPct} color="success" sx={{ height: 8, borderRadius: 4, mb: 1.5 }} />
                    <Stack spacing={0.75}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Total Required Qty</Typography>
                        <Typography variant="caption" fontWeight={600}>{numberFmt(totalRequired)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Total Issued Qty</Typography>
                        <Typography variant="caption" fontWeight={600}>{numberFmt(totalIssued)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Balance Qty</Typography>
                        <Typography variant="caption" fontWeight={600}>{numberFmt(balanceQty)}</Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Pending Material Issue</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ px: 0.5 }}>S.No</TableCell>
                          <TableCell sx={{ px: 0.5 }}>Component Code</TableCell>
                          <TableCell sx={{ px: 0.5 }}>Component Description</TableCell>
                          <TableCell sx={{ px: 0.5 }} align="right">Pending Qty</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {PENDING.map((p) => (
                          <TableRow key={p.code}>
                            <TableCell sx={{ px: 0.5 }}>{p.no}</TableCell>
                            <TableCell sx={{ px: 0.5 }}><Typography variant="caption" color="primary.main" fontWeight={600}>{p.code}</Typography></TableCell>
                            <TableCell sx={{ px: 0.5 }}><Typography variant="caption">{p.desc}</Typography></TableCell>
                            <TableCell sx={{ px: 0.5 }} align="right"><Typography variant="caption" fontWeight={600}>{numberFmt(p.pending)}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Button
                      fullWidth variant="contained" startIcon={<NoteAddOutlinedIcon />}
                      sx={{ mt: 1.5 }}
                    >
                      Create Material Requisition
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
