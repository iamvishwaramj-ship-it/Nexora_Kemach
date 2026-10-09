import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell, FormControlLabel, Checkbox,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Closure" screen, built to match
// the reference design the user supplied for the Production Execution >
// Production Closure submenu. Same convention as the other Production
// Execution screens (Operations, Material Issue, Material Receipt, ...):
// there is no ProductionClosure / costing / inventory-posting data model in
// this schema, so this lays out the screen exactly as designed with fixed
// mock data for one order (PO-2026-001) rather than fabricating "real"
// records against tables that don't exist. Local state only -- nothing
// here persists or calls the server; the tab strip just switches which
// panel label is active (only "Closure Details" has mock content here,
// matching the reference image -- the other tabs show a neutral empty
// state, same pattern used on the other tabbed Production Execution pages).
// ---------------------------------------------------------------------------

const ORDER = {
  no: 'PO-2026-001',
  itemCode: 'FG-1001',
  itemDesc: 'Gear Housing',
  plannedQty: 500,
  uom: 'Nos',
  status: 'Completed',
  plant: 'Main Plant',
  workCenter: 'WC-01 - Machining',
  routingOperation: 'OP-10 - Machining',
  bomNo: 'BOM-1001',
  startDate: '2026-10-01',
  dueDate: '2026-10-10',
};

const CONSUMPTION = [
  { no: 1, code: 'RM-2001', desc: 'Cast Iron', uom: 'Kg', planned: 1600, issued: 1600, consumed: 1550, variance: -50, status: 'OK' },
  { no: 2, code: 'RM-2002', desc: 'Bearing 6205', uom: 'Nos', planned: 100, issued: 100, consumed: 95, variance: -5, status: 'OK' },
  { no: 3, code: 'RM-2003', desc: 'Gasket', uom: 'Nos', planned: 100, issued: 100, consumed: 95, variance: -5, status: 'OK' },
];

const OUTPUTS = [
  { no: 1, code: 'FG-1001', desc: 'Gear Housing (Good)', uom: 'Nos', qty: 480, remarks: 'Accepted to Stock' },
  { no: 2, code: 'FG-1001', desc: 'Gear Housing (Rework)', uom: 'Nos', qty: 10, remarks: 'Sent to Rework' },
  { no: 3, code: 'FG-1001', desc: 'Gear Housing (Scrap)', uom: 'Nos', qty: 10, remarks: 'Scrapped' },
];

const COSTING = [
  { no: 1, element: 'Material Cost', planned: 480000, actual: 465000, variance: -15000 },
  { no: 2, element: 'Labour Cost', planned: 50000, actual: 52000, variance: 2000 },
  { no: 3, element: 'Machine Cost', planned: 30000, actual: 31000, variance: 1000 },
];
const COSTING_TOTAL = {
  planned: COSTING.reduce((sum, c) => sum + c.planned, 0),
  actual: COSTING.reduce((sum, c) => sum + c.actual, 0),
  variance: COSTING.reduce((sum, c) => sum + c.variance, 0),
};

const INVENTORY_POSTINGS = [
  { no: 1, type: 'Goods Receipt', code: 'FG-1001', qty: 480, status: 'Posted', postedOn: '10-Oct-2026 14:30', ref: 'GR-2026-001' },
  { no: 2, type: 'Rework Issue', code: 'FG-1001', qty: 10, status: 'Posted', postedOn: '10-Oct-2026 14:30', ref: 'RS-2026-003' },
  { no: 3, type: 'Scrap Issue', code: 'FG-1001', qty: 10, status: 'Posted', postedOn: '10-Oct-2026 14:30', ref: 'RS-2026-004' },
];

const TABS = ['Closure Details', 'Consumption Summary', 'Output Summary', 'Rework & Scrap', 'Costing Summary', 'Attachments', 'Remarks'];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fieldRow(label, value) {
  return (
    <Grid item xs={6} sm={4} md={2} key={label}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Grid>
  );
}

export default function ProductionClosure() {
  const [tab, setTab] = useState(0); // Closure Details tab active, matching the reference image

  const [autoGenerate, setAutoGenerate] = useState(true);
  const [closureNo] = useState('CL-2026-001');
  const [closureDate, setClosureDate] = useState('2026-10-10');
  const [closedBy, setClosedBy] = useState('Kannan P');
  const [closureType, setClosureType] = useState('Normal Closure');
  const [varianceReason, setVarianceReason] = useState('');
  const [remarks, setRemarks] = useState('Production order completed and closed.');

  const summary = {
    plannedQty: ORDER.plannedQty,
    completedQty: 480,
    reworkQty: 10,
    scrapQty: 10,
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Production Closure"
        subtitle="Close production orders, reconcile issued/consumed/scrap/rework quantities and post final inventory & cost."
      />

      {/* Production Order Details */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Production Order Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Production Order No." value={ORDER.no} disabled
                InputProps={{ endAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Item Code" value={ORDER.itemCode} disabled
                InputProps={{ endAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" label="Item Description" value={ORDER.itemDesc} disabled />
            </Grid>
            <Grid item xs={6} sm={3} md={1.5}>
              <TextField fullWidth size="small" label="Planned Qty" value={ORDER.plannedQty} disabled />
            </Grid>
            <Grid item xs={6} sm={3} md={1.5}>
              <TextField fullWidth size="small" select label="UOM" value={ORDER.uom} disabled>
                <MenuItem value={ORDER.uom}>{ORDER.uom}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3} md={1.5}>
              <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
              <Chip size="small" label={ORDER.status} color="success" sx={{ mt: 0.5 }} />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Plant / Location" value={ORDER.plant} disabled>
                <MenuItem value={ORDER.plant}>{ORDER.plant}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Work Center" value={ORDER.workCenter} disabled>
                <MenuItem value={ORDER.workCenter}>{ORDER.workCenter}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Routing Operation" value={ORDER.routingOperation} disabled>
                <MenuItem value={ORDER.routingOperation}>{ORDER.routingOperation}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="BOM No." value={ORDER.bomNo} disabled
                InputProps={{ endAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /> }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" type="date" label="Start Date" value={ORDER.startDate} disabled InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField fullWidth size="small" type="date" label="Due Date" value={ORDER.dueDate} disabled InputLabelProps={{ shrink: true }} />
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
          {tab === 0 ? (
            <>
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                {/* Closure Information */}
                <Grid item xs={12} lg={7}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Closure Information</Typography>
                  <Grid container spacing={2.5}>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" label="Closure No." value={closureNo} disabled />
                      <FormControlLabel
                        sx={{ mt: 0.5 }}
                        control={<Checkbox size="small" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
                        label={<Typography variant="caption">Auto Generate</Typography>}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth size="small" required type="date" label="Closure Date"
                        value={closureDate} onChange={(e) => setClosureDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField fullWidth size="small" required select label="Closed By" value={closedBy} onChange={(e) => setClosedBy(e.target.value)}>
                        <MenuItem value="Kannan P">Kannan P</MenuItem>
                        <MenuItem value="Mani">Mani</MenuItem>
                        <MenuItem value="Dheena S">Dheena S</MenuItem>
                        <MenuItem value="Arunkumar">Arunkumar</MenuItem>
                      </TextField>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" required select label="Closure Type" value={closureType} onChange={(e) => setClosureType(e.target.value)}>
                        <MenuItem value="Normal Closure">Normal Closure</MenuItem>
                        <MenuItem value="Partial Closure">Partial Closure</MenuItem>
                        <MenuItem value="Forced Closure">Forced Closure</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" select label="Variance Reason" value={varianceReason} onChange={(e) => setVarianceReason(e.target.value)}>
                        <MenuItem value="">Select Reason</MenuItem>
                        <MenuItem value="Yield loss">Yield loss</MenuItem>
                        <MenuItem value="Process scrap">Process scrap</MenuItem>
                        <MenuItem value="Material price variance">Material price variance</MenuItem>
                        <MenuItem value="Other">Other</MenuItem>
                      </TextField>
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth size="small" label="Remarks" multiline minRows={3}
                        value={remarks} onChange={(e) => setRemarks(e.target.value.slice(0, 500))}
                      />
                      <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 0.5 }}>
                        {remarks.length}/500
                      </Typography>
                    </Grid>
                  </Grid>
                </Grid>

                {/* Production Summary */}
                <Grid item xs={12} lg={5}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Production Summary</Typography>
                  <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid item xs={6} sm={3}>
                      <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'info.lighter', borderRadius: 2, py: 2 }}>
                        <Inventory2OutlinedIcon color="info" />
                        <Typography variant="h6" fontWeight={700}>{numberFmt(summary.plannedQty)}</Typography>
                        <Typography variant="caption" color="text.secondary" textAlign="center">Planned Qty<br />{ORDER.uom}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'success.lighter', borderRadius: 2, py: 2 }}>
                        <CheckCircleIcon color="success" />
                        <Typography variant="h6" fontWeight={700}>{numberFmt(summary.completedQty)}</Typography>
                        <Typography variant="caption" color="text.secondary" textAlign="center">Completed Qty<br />{ORDER.uom}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'warning.lighter', borderRadius: 2, py: 2 }}>
                        <AutorenewIcon color="warning" />
                        <Typography variant="h6" fontWeight={700}>{numberFmt(summary.reworkQty)}</Typography>
                        <Typography variant="caption" color="text.secondary" textAlign="center">Rework Qty<br />{ORDER.uom}</Typography>
                      </Stack>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Stack alignItems="center" spacing={0.5} sx={{ bgcolor: 'error.lighter', borderRadius: 2, py: 2 }}>
                        <CancelIcon color="error" />
                        <Typography variant="h6" fontWeight={700}>{numberFmt(summary.scrapQty)}</Typography>
                        <Typography variant="caption" color="text.secondary" textAlign="center">Scrap Qty<br />{ORDER.uom}</Typography>
                      </Stack>
                    </Grid>
                  </Grid>

                  <Card variant="outlined" sx={{ bgcolor: 'success.lighter', borderColor: 'success.light' }}>
                    <CardContent>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <CheckCircleIcon color="success" />
                        <Box>
                          <Typography variant="body2" fontWeight={700}>Production Order Closed Successfully</Typography>
                          <Typography variant="caption" color="text.secondary">All quantities reconciled and posted to inventory.</Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Material Consumption Summary + Output Summary */}
              <Grid container spacing={2} sx={{ mb: 2.5 }}>
                <Grid item xs={12} lg={6}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Material Consumption Summary</Typography>
                  <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 760px), 240px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>S.No</TableCell>
                          <TableCell>Item Code</TableCell>
                          <TableCell>Item Description</TableCell>
                          <TableCell>UOM</TableCell>
                          <TableCell align="right">Planned Qty</TableCell>
                          <TableCell align="right">Issued Qty</TableCell>
                          <TableCell align="right">Consumed Qty</TableCell>
                          <TableCell align="right">Variance</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {CONSUMPTION.map((c) => (
                          <TableRow key={c.code} hover>
                            <TableCell>{c.no}</TableCell>
                            <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{c.code}</Typography></TableCell>
                            <TableCell>{c.desc}</TableCell>
                            <TableCell>{c.uom}</TableCell>
                            <TableCell align="right">{numberFmt(c.planned)}</TableCell>
                            <TableCell align="right">{numberFmt(c.issued)}</TableCell>
                            <TableCell align="right">{numberFmt(c.consumed)}</TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color={c.variance < 0 ? 'error.main' : 'text.primary'} fontWeight={600}>
                                {c.variance}
                              </Typography>
                            </TableCell>
                            <TableCell><Chip size="small" label={c.status} color="success" /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </Grid>

                <Grid item xs={12} lg={6}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Output Summary</Typography>
                  <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 760px), 240px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>S.No</TableCell>
                          <TableCell>Item Code</TableCell>
                          <TableCell>Item Description</TableCell>
                          <TableCell>UOM</TableCell>
                          <TableCell align="right">Qty</TableCell>
                          <TableCell>Remarks</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {OUTPUTS.map((o) => (
                          <TableRow key={o.desc} hover>
                            <TableCell>{o.no}</TableCell>
                            <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{o.code}</Typography></TableCell>
                            <TableCell>{o.desc}</TableCell>
                            <TableCell>{o.uom}</TableCell>
                            <TableCell align="right">{numberFmt(o.qty)}</TableCell>
                            <TableCell>{o.remarks}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </Grid>
              </Grid>

              {/* Costing Summary + Inventory Posting Status */}
              <Grid container spacing={2}>
                <Grid item xs={12} lg={6}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Costing Summary</Typography>
                  <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 760px), 240px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>S.No</TableCell>
                          <TableCell>Cost Element</TableCell>
                          <TableCell align="right">Planned Cost (INR)</TableCell>
                          <TableCell align="right">Actual Cost (INR)</TableCell>
                          <TableCell align="right">Variance (INR)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {COSTING.map((c) => (
                          <TableRow key={c.element} hover>
                            <TableCell>{c.no}</TableCell>
                            <TableCell>{c.element}</TableCell>
                            <TableCell align="right">{money(c.planned)}</TableCell>
                            <TableCell align="right">{money(c.actual)}</TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color={c.variance < 0 ? 'error.main' : 'success.main'} fontWeight={600}>
                                {money(c.variance)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                          <TableCell />
                          <TableCell><Typography variant="body2" fontWeight={700}>Total Cost</Typography></TableCell>
                          <TableCell align="right"><Typography variant="body2" fontWeight={700}>{money(COSTING_TOTAL.planned)}</Typography></TableCell>
                          <TableCell align="right"><Typography variant="body2" fontWeight={700}>{money(COSTING_TOTAL.actual)}</Typography></TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight={700} color={COSTING_TOTAL.variance < 0 ? 'error.main' : 'success.main'}>
                              {money(COSTING_TOTAL.variance)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </Grid>

                <Grid item xs={12} lg={6}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Inventory Posting Status</Typography>
                  <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 760px), 240px)">
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>S.No</TableCell>
                          <TableCell>Transaction Type</TableCell>
                          <TableCell>Item Code</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Posted On</TableCell>
                          <TableCell>Reference No.</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {INVENTORY_POSTINGS.map((p) => (
                          <TableRow key={p.ref} hover>
                            <TableCell>{p.no}</TableCell>
                            <TableCell>{p.type}</TableCell>
                            <TableCell>{p.code}</TableCell>
                            <TableCell align="right">{numberFmt(p.qty)}</TableCell>
                            <TableCell><Chip size="small" label={p.status} color="success" /></TableCell>
                            <TableCell>{p.postedOn}</TableCell>
                            <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{p.ref}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                </Grid>
              </Grid>
            </>
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
        <Button variant="outlined" startIcon={<RestartAltIcon />}>Reset</Button>
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />}>Save as Draft</Button>
        <Button variant="contained" startIcon={<CheckCircleIcon />}>Close Production Order</Button>
      </Stack>
    </Box>
  );
}
