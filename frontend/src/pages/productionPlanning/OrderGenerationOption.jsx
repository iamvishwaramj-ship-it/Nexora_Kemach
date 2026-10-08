import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, TextField, MenuItem,
  Avatar, Tabs, Tab, IconButton,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GroupsIcon from '@mui/icons-material/Groups';
import BuildIcon from '@mui/icons-material/Build';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Order Generation Options" screen, built to
// match the reference design the user supplied. Same convention as the
// Production Planning > Dashboard and > Generate Order - MRP pages already
// built this way: Routing, BOM Version, Vendor assignment, and order
// priority/status have no backing data model in this schema (same gap
// already surfaced for those two screens), so this lays out the screen
// exactly as designed with fixed mock data. Local state only -- the
// checkboxes/selects are interactive for feel, but nothing here persists or
// calls the server, and "Generate Orders" does not create real documents.
// ---------------------------------------------------------------------------

const HEADER_INFO = [
  { label: 'GO Number', value: 'GO-2026-10-001', withGear: true },
  { label: 'Source Type', value: 'MRP', isSourceChip: true },
  { label: 'MRP Run', value: 'MRP-2026-10-01' },
  { label: 'Selected Items', value: '3' },
  { label: 'GO Date', value: '01-Oct-2026' },
  { label: 'Required Delivery Date', value: '31-Dec-2026' },
  { label: 'Plant / Location', value: 'Main Plant' },
];

const SCOPE_OPTIONS = [
  { key: 'production', label: 'Production Orders', desc: 'For Make items', icon: PrecisionManufacturingIcon, color: '#1565c0' },
  { key: 'purchase', label: 'Purchase Orders', desc: 'For Buy items', icon: ShoppingCartIcon, color: '#e65100' },
  { key: 'subcontracting', label: 'Subcontracting Orders', desc: 'For Subcontract items', icon: GroupsIcon, color: '#6a1b9a' },
  { key: 'jobwork', label: 'Job Work Orders', desc: 'For Job Work items', icon: BuildIcon, color: '#00695c' },
];

const PRODUCTION_ROWS = [
  { code: 'FG-1001', desc: 'Gear Housing', required: 500, qty: 500, uom: 'Nos', start: '02-Oct-2026', due: '05-Oct-2026', routing: 'RT-01', bom: 'BOM-001 (A)', priority: 'Normal', status: 'Ready' },
  { code: 'FG-1003', desc: 'Pump Cover', required: 400, qty: 400, uom: 'Nos', start: '06-Oct-2026', due: '12-Oct-2026', routing: 'RT-03', bom: 'BOM-003 (B)', priority: 'Normal', status: 'Ready' },
];

const PURCHASE_ROWS = [
  { code: 'RM-010', desc: 'Paint', required: 50, qty: 50, uom: 'Nos', vendor: 'SUP-004', expected: '03-Oct-2026', priority: 'Normal', status: 'Ready' },
];

const SUMMARY_CARDS = [
  { key: 'production', label: 'Production Orders', icon: PrecisionManufacturingIcon, color: '#1565c0', items: 2, qty: '900', unit: 'Nos' },
  { key: 'purchase', label: 'Purchase Orders', icon: ShoppingCartIcon, color: '#e65100', items: 1, qty: '500', unit: 'Nos' },
  { key: 'subcontracting', label: 'Subcontracting Orders', icon: GroupsIcon, color: '#6a1b9a', items: 0, qty: '0', unit: 'Nos' },
  { key: 'jobwork', label: 'Job Work Orders', icon: BuildIcon, color: '#00695c', items: 0, qty: '0', unit: 'Nos' },
];

const ITEM_WISE_ORDER_TYPE = [
  { code: 'FG-1001', desc: 'Gear Housing', type: 'Production Order', qty: 500 },
  { code: 'FG-1002', desc: 'Motor Bracket', type: 'Purchase Order', qty: 500 },
  { code: 'FG-1003', desc: 'Pump Cover', type: 'Production Order', qty: 400 },
];

const ORDER_TYPE_COLOR = { 'Production Order': 'info', 'Purchase Order': 'warning', 'Subcontracting Order': 'secondary', 'Job Work Order': 'success' };

const VALIDATION_MESSAGES = [
  { level: 'ok', text: 'All selected items have valid BOM and Routing' },
  { level: 'ok', text: 'Net requirement calculated based on current stock and open orders' },
  { level: 'ok', text: 'Vendor available for Purchase Orders' },
  { level: 'ok', text: 'No pending QC hold for selected items' },
  { level: 'warn', text: 'Item RM-005 will be generated as Purchase Order due to shortage' },
  { level: 'warn', text: 'Operations for FG-1003 have long lead time (5 days)' },
];

const INFO_MESSAGES = [
  'System will consider existing open orders, reservations and current stock.',
  'Orders will be grouped based on vendor and work center (as per settings).',
  'You can review the orders before final generation.',
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function OrderGenerationOption() {
  const navigate = useNavigate();
  const [scopeChecks, setScopeChecks] = useState({ production: true, purchase: true, subcontracting: true, jobwork: true });
  const [activeTab, setActiveTab] = useState('production');
  const [prodSelected, setProdSelected] = useState(() => new Set(PRODUCTION_ROWS.map((r) => r.code)));
  const [purchaseSelected, setPurchaseSelected] = useState(() => new Set(PURCHASE_ROWS.map((r) => r.code)));
  const [prodQty, setProdQty] = useState(() => Object.fromEntries(PRODUCTION_ROWS.map((r) => [r.code, r.qty])));
  const [purchaseQty, setPurchaseQty] = useState(() => Object.fromEntries(PURCHASE_ROWS.map((r) => [r.code, r.qty])));
  const [subcontractOpen, setSubcontractOpen] = useState(true);
  const [jobWorkOpen, setJobWorkOpen] = useState(true);

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Order Generation Options"
        subtitle="Select order types and review the proposed orders to generate based on MRP results."
      />

      {/* Header info strip */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2.5}>
            {HEADER_INFO.map((f) => (
              <Grid item xs={6} sm={4} md={12 / HEADER_INFO.length} key={f.label}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{f.label}</Typography>
                {f.isSourceChip ? (
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
                    <Avatar sx={{ bgcolor: 'warning.main', width: 22, height: 22 }}>
                      <AssignmentOutlinedIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                    <Typography variant="body2" fontWeight={600}>{f.value}</Typography>
                  </Stack>
                ) : (
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="body2" fontWeight={600}>{f.value}</Typography>
                    {f.withGear && (
                      <IconButton size="small" sx={{ p: 0.25 }}>
                        <SettingsIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Stack>
                )}
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {/* Left column */}
        <Grid item xs={12} lg={8.5}>
          {/* Section 1 */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 28, height: 28, fontSize: 14 }}>1</Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>Order Generation Scope</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Select which orders to generate for the selected items based on net requirements.
                  </Typography>
                </Box>
              </Stack>
              <Grid container spacing={2}>
                {SCOPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const checked = scopeChecks[opt.key];
                  return (
                    <Grid item xs={12} sm={6} md={3} key={opt.key}>
                      <Card
                        variant="outlined"
                        sx={{ borderColor: checked ? 'primary.main' : 'divider', borderWidth: checked ? 2 : 1, cursor: 'pointer' }}
                        onClick={() => setScopeChecks((p) => ({ ...p, [opt.key]: !p[opt.key] }))}
                      >
                        <CardContent sx={{ py: 1.5 }}>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Checkbox size="small" checked={checked} onClick={(e) => e.stopPropagation()} onChange={() => setScopeChecks((p) => ({ ...p, [opt.key]: !p[opt.key] }))} sx={{ p: 0 }} />
                            <Avatar sx={{ bgcolor: opt.color, width: 32, height: 32 }}>
                              <Icon sx={{ fontSize: 18 }} />
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={700}>{opt.label}</Typography>
                              <Typography variant="caption" color="text.secondary">{opt.desc}</Typography>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>

          {/* Section 2 */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 28, height: 28, fontSize: 14 }}>2</Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>Order Preview &amp; Exceptions</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Review the proposed orders based on MRP results. You can modify the order quantity or due date before generation.
                  </Typography>
                </Box>
              </Stack>

              <Tabs
                value={activeTab}
                onChange={(e, v) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}
              >
                <Tab value="production" icon={<PrecisionManufacturingIcon fontSize="small" />} iconPosition="start" label={`Production Orders (${PRODUCTION_ROWS.length})`} />
                <Tab value="purchase" icon={<ShoppingCartIcon fontSize="small" />} iconPosition="start" label={`Purchase Orders (${PURCHASE_ROWS.length})`} />
                <Tab value="subcontracting" icon={<GroupsIcon fontSize="small" />} iconPosition="start" label="Subcontracting Orders (0)" />
                <Tab value="jobwork" icon={<BuildIcon fontSize="small" />} iconPosition="start" label="Job Work Orders (0)" />
              </Tabs>

              {/* Production Orders */}
              <Stack direction="row" spacing={1.25} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
                <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />}>Edit Qty</Button>
                <Button size="small" variant="outlined" startIcon={<EventOutlinedIcon />}>Change Date</Button>
                <Button size="small" variant="outlined" startIcon={<PriorityHighOutlinedIcon />}>Change Priority</Button>
                <Button size="small" variant="outlined" startIcon={<AccountTreeOutlinedIcon />}>View BOM &amp; Routing</Button>
              </Stack>
              <ScrollableTableContainer maxHeight="none">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>S.No</TableCell>
                      <TableCell>FG Item Code</TableCell>
                      <TableCell>FG Description</TableCell>
                      <TableCell align="right">Required Qty</TableCell>
                      <TableCell align="right">Order Qty</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell>Planned Start Date</TableCell>
                      <TableCell>Due Date</TableCell>
                      <TableCell>Routing</TableCell>
                      <TableCell>BOM Version</TableCell>
                      <TableCell>Order Priority</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {PRODUCTION_ROWS.map((r, idx) => (
                      <TableRow key={r.code} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small" checked={prodSelected.has(r.code)}
                            onChange={() => setProdSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.code)) next.delete(r.code); else next.add(r.code);
                              return next;
                            })}
                          />
                        </TableCell>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.code}</Typography></TableCell>
                        <TableCell>{r.desc}</TableCell>
                        <TableCell align="right">{numberFmt(r.required)}</TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small" type="number" value={prodQty[r.code]}
                            onChange={(e) => setProdQty((p) => ({ ...p, [r.code]: e.target.value }))}
                            sx={{ width: 90 }}
                          />
                        </TableCell>
                        <TableCell>{r.uom}</TableCell>
                        <TableCell>{r.start}</TableCell>
                        <TableCell>{r.due}</TableCell>
                        <TableCell>{r.routing}</TableCell>
                        <TableCell>{r.bom}</TableCell>
                        <TableCell sx={{ minWidth: 110 }}>
                          <TextField size="small" select defaultValue={r.priority} fullWidth>
                            <MenuItem value="Low">Low</MenuItem>
                            <MenuItem value="Normal">Normal</MenuItem>
                            <MenuItem value="High">High</MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell><Chip size="small" label={r.status} color="success" variant="outlined" /></TableCell>
                        <TableCell>-</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </CardContent>
          </Card>

          {/* Purchase Orders */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5 }}>
                <Avatar sx={{ bgcolor: 'warning.main', width: 32, height: 32 }}>
                  <ShoppingCartIcon sx={{ fontSize: 18 }} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>Purchase Orders ({PURCHASE_ROWS.length})</Typography>
              </Stack>
              <Stack direction="row" spacing={1.25} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
                <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />}>Edit Qty</Button>
                <Button size="small" variant="outlined" startIcon={<EventOutlinedIcon />}>Change Date</Button>
                <Button size="small" variant="outlined" startIcon={<StoreOutlinedIcon />}>Change Vendor</Button>
              </Stack>
              <ScrollableTableContainer maxHeight="none">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>S.No</TableCell>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Description</TableCell>
                      <TableCell align="right">Required Qty</TableCell>
                      <TableCell align="right">Order Qty</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell>Vendor</TableCell>
                      <TableCell>Expected Delivery Date</TableCell>
                      <TableCell>Order Priority</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {PURCHASE_ROWS.map((r, idx) => (
                      <TableRow key={r.code} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small" checked={purchaseSelected.has(r.code)}
                            onChange={() => setPurchaseSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.code)) next.delete(r.code); else next.add(r.code);
                              return next;
                            })}
                          />
                        </TableCell>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.code}</Typography></TableCell>
                        <TableCell>{r.desc}</TableCell>
                        <TableCell align="right">{numberFmt(r.required)}</TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small" type="number" value={purchaseQty[r.code]}
                            onChange={(e) => setPurchaseQty((p) => ({ ...p, [r.code]: e.target.value }))}
                            sx={{ width: 90 }}
                          />
                        </TableCell>
                        <TableCell>{r.uom}</TableCell>
                        <TableCell>{r.vendor}</TableCell>
                        <TableCell>{r.expected}</TableCell>
                        <TableCell sx={{ minWidth: 110 }}>
                          <TextField size="small" select defaultValue={r.priority} fullWidth>
                            <MenuItem value="Low">Low</MenuItem>
                            <MenuItem value="Normal">Normal</MenuItem>
                            <MenuItem value="High">High</MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell><Chip size="small" label={r.status} color="success" variant="outlined" /></TableCell>
                        <TableCell>-</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </CardContent>
          </Card>

          {/* Subcontracting Orders (empty) */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <Stack
              direction="row" alignItems="center" justifyContent="space-between"
              sx={{ px: 2.5, py: 1.5, cursor: 'pointer' }}
              onClick={() => setSubcontractOpen((v) => !v)}
            >
              <Stack direction="row" alignItems="center" spacing={1.25}>
                <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                  <GroupsIcon sx={{ fontSize: 18 }} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>Subcontracting Orders (0)</Typography>
              </Stack>
              <ExpandMoreIcon sx={{ transform: subcontractOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </Stack>
            {subcontractOpen && (
              <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <InsertDriveFileOutlinedIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary">No subcontracting orders to generate for the selected items.</Typography>
              </Stack>
            )}
          </Card>

          {/* Job Work Orders (empty) */}
          <Card variant="outlined">
            <Stack
              direction="row" alignItems="center" justifyContent="space-between"
              sx={{ px: 2.5, py: 1.5, cursor: 'pointer' }}
              onClick={() => setJobWorkOpen((v) => !v)}
            >
              <Stack direction="row" alignItems="center" spacing={1.25}>
                <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                  <BuildIcon sx={{ fontSize: 18 }} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>Job Work Orders (0)</Typography>
              </Stack>
              <ExpandMoreIcon sx={{ transform: jobWorkOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </Stack>
            {jobWorkOpen && (
              <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                <InsertDriveFileOutlinedIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary">No job work orders to generate for the selected items.</Typography>
              </Stack>
            )}
          </Card>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} lg={3.5}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <BarChartIcon fontSize="small" color="action" />
                <Typography variant="subtitle1" fontWeight={700}>Summary</Typography>
              </Stack>
              <Grid container spacing={1.5}>
                {SUMMARY_CARDS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <Grid item xs={6} key={c.key}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Avatar sx={{ bgcolor: c.color, width: 32, height: 32, mb: 1 }}>
                            <Icon sx={{ fontSize: 18 }} />
                          </Avatar>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{c.label}</Typography>
                          <Typography variant="caption" color="text.secondary">{c.items} Items</Typography>
                          <Typography variant="h6" fontWeight={700}>{c.qty} <Typography component="span" variant="caption" color="text.secondary">{c.unit}</Typography></Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Item Wise Order Type</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Item Description</TableCell>
                    <TableCell>Order Type</TableCell>
                    <TableCell align="right">Order Qty</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ITEM_WISE_ORDER_TYPE.map((r) => (
                    <TableRow key={r.code}>
                      <TableCell><Typography variant="caption" fontWeight={600}>{r.code}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{r.desc}</Typography></TableCell>
                      <TableCell><Chip size="small" label={r.type} color={ORDER_TYPE_COLOR[r.type]} /></TableCell>
                      <TableCell align="right"><Typography variant="caption" fontWeight={600}>{numberFmt(r.qty)}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2, bgcolor: 'rgba(255, 152, 0, 0.06)', borderColor: 'warning.light' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <WarningAmberIcon fontSize="small" color="warning" />
                  <Typography variant="subtitle2" fontWeight={700}>Validation Messages</Typography>
                </Stack>
                <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ cursor: 'pointer' }}>View All →</Typography>
              </Stack>
              <Stack spacing={0.75}>
                {VALIDATION_MESSAGES.map((m, idx) => (
                  <Stack key={idx} direction="row" spacing={1} alignItems="flex-start">
                    {m.level === 'ok'
                      ? <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main', mt: 0.25 }} />
                      : <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main', mt: 0.25 }} />}
                    <Typography variant="caption">{m.text}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ bgcolor: 'rgba(33, 150, 243, 0.06)', borderColor: 'info.light' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <InfoOutlinedIcon fontSize="small" color="info" />
                <Typography variant="subtitle2" fontWeight={700}>Information</Typography>
              </Stack>
              <Stack spacing={0.75} component="ul" sx={{ pl: 2, m: 0 }}>
                {INFO_MESSAGES.map((t, idx) => (
                  <Typography key={idx} component="li" variant="caption" color="text.secondary">{t}</Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom action bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/production-planning/generate-order-mrp')}>Back</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />}>Save as Template</Button>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export to Excel</Button>
        <Button
          variant="contained" color="warning" startIcon={<SettingsSuggestIcon />}
          onClick={() => navigate('/production-planning/generated-orders')}
        >
          Generate Orders
        </Button>
      </Stack>
    </Box>
  );
}
