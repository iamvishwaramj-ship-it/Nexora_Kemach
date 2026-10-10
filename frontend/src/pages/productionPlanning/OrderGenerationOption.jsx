import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TextField,
  Avatar, Tabs, Tab, IconButton, CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
import { useNotify } from '../../components/feedback/NotificationProvider';
import {
  useGetGenerationOrderQuery, useUpdateGenerationOrderMutation, useGenerateOrdersMutation,
} from '../../features/productionPlanningApi';
import { isDemoMode } from '../../lib/demoMode';
import { DEMO_GENERATION_ORDER, DEMO_GO_ID } from '../../lib/demoData/generationOrder';

// ---------------------------------------------------------------------------
// Order Generation Options — Phase 1 (MRP & Order Generation), approved
// scope. Shows the real Generation Order (and its lines) created by
// Generate Order - MRP/Manual/Sales Order/Forecast via POST
// /production-planning/generation-orders, lets the Production/Purchase
// lines' quantity and due date be edited (PUT .../generation-orders/:id),
// and finally calls POST .../generation-orders/:id/generate, which creates
// real Production Orders (reusing productionOrders.js's existing BOM/
// Routing snapshot logic) and real Purchase Orders (reusing resources.js's
// existing logic) inside one DB transaction. Subcontracting and Job Work
// are not modelled anywhere in the schema (approved decision 1) — their
// panels always show empty/disabled rather than simulated data.
// ---------------------------------------------------------------------------

const INFO_MESSAGES = [
  'Orders are generated from this Generation Order\'s lines only — nothing else on the shop floor is affected.',
  'Production Orders reuse the same BOM/Routing snapshot logic as a manually created Production Order.',
  'No stock is reserved and no inventory or accounting entry is created by this screen.',
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

export default function OrderGenerationOption() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [searchParams] = useSearchParams();
  // In demo mode, show the fixed demo Generation Order even if the screen
  // is opened directly with no goId in the URL (see lib/demoMode.js) —
  // outside demo mode this is unchanged: a missing goId still shows the
  // "No Generation Order selected" guard below.
  const goId = Number(searchParams.get('goId')) || (isDemoMode() ? DEMO_GO_ID : null);

  const { data: realGo, isLoading, isError } = useGetGenerationOrderQuery(goId, { skip: !goId || isDemoMode() });
  const [updateGo] = useUpdateGenerationOrderMutation();
  const [generateOrders, { isLoading: generating }] = useGenerateOrdersMutation();

  // Client-demo path: frontend-only, uses a fixed static Generation Order
  // instead of fetching from the backend (see lib/demoMode.js). Flip
  // DEMO_MODE back to false to restore the real fetch above unchanged.
  const go = isDemoMode() ? DEMO_GENERATION_ORDER : realGo;

  const [activeTab, setActiveTab] = useState('production');
  const [edits, setEdits] = useState({});

  const lines = go?.lines || [];
  const productionLines = lines.filter((l) => l.orderType === 'Production');
  const purchaseLines = lines.filter((l) => l.orderType === 'Purchase');

  const summary = useMemo(() => ([
    { key: 'production', label: 'Production Orders', icon: PrecisionManufacturingIcon, color: 'info.main', items: productionLines.length, qty: productionLines.reduce((s, l) => s + Number(l.orderQty || 0), 0) },
    { key: 'purchase', label: 'Purchase Orders', icon: ShoppingCartIcon, color: 'warning.main', items: purchaseLines.length, qty: purchaseLines.reduce((s, l) => s + Number(l.orderQty || 0), 0) },
    { key: 'subcontracting', label: 'Subcontracting Orders', icon: GroupsIcon, color: 'secondary.main', items: 0, qty: 0, disabled: true },
    { key: 'jobwork', label: 'Job Work Orders', icon: BuildIcon, color: 'success.main', items: 0, qty: 0, disabled: true },
  ]), [productionLines, purchaseLines]);

  const validationMessages = useMemo(() => {
    const msgs = [];
    if (lines.length > 0) msgs.push({ level: 'ok', text: `${lines.length} line(s) ready — quantities and dates taken from this Generation Order.` });
    purchaseLines.forEach((l) => {
      if (!l.vendorCode) msgs.push({ level: 'warn', text: `${l.productCode} has no vendor assigned — set a default supplier on the product or vendor before generating.` });
    });
    if (go?.status === 'Completed') msgs.push({ level: 'ok', text: 'Orders have already been generated from this Generation Order.' });
    return msgs;
  }, [lines, purchaseLines, go]);

  const getLineValue = (line, field) => (edits[line.id]?.[field] !== undefined ? edits[line.id][field] : line[field]);
  const setLineValue = (line, field, value) => setEdits((p) => ({ ...p, [line.id]: { ...p[line.id], [field]: value } }));

  const handleSaveEdits = async () => {
    if (Object.keys(edits).length === 0) return;
    if (isDemoMode()) {
      setEdits({});
      notify.success('Changes saved');
      return;
    }
    try {
      await updateGo({
        id: goId,
        lines: lines.map((l) => ({
          id: l.id,
          orderQty: getLineValue(l, 'orderQty'),
          dueDate: getLineValue(l, 'dueDate'),
        })),
      }).unwrap();
      setEdits({});
      notify.success('Changes saved');
    } catch (err) {
      notify.error(err?.data?.message || 'Could not save changes');
    }
  };

  const handleGenerate = async () => {
    if (isDemoMode()) {
      notify.success('Orders generated');
      navigate(`/production-planning/generate-order?goId=${goId}`);
      return;
    }
    try {
      if (Object.keys(edits).length > 0) await handleSaveEdits();
      const result = await generateOrders(goId).unwrap();
      notify.success('Orders generated');
      navigate(`/production-planning/generate-order?goId=${goId}`);
    } catch (err) {
      notify.error(err?.data?.message || 'Could not generate orders');
    }
  };

  if (!goId) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">No Generation Order selected. Go back to Generate Order and create one first.</Typography>
        <Button sx={{ mt: 2 }} variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/production-planning/generate-order-mrp')}>Back</Button>
      </Box>
    );
  }

  if (isLoading) {
    return <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={28} /></Box>;
  }

  if (isError || !go) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="error">Could not load this Generation Order.</Typography>
        <Button sx={{ mt: 2 }} variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/production-planning/generate-order-mrp')}>Back</Button>
      </Box>
    );
  }

  const headerInfo = [
    { label: 'GO Number', value: go.goNumber || '(pending)', withGear: true },
    { label: 'Source Type', value: go.sourceType, isSourceChip: true },
    { label: 'Selected Items', value: String(lines.length) },
    { label: 'GO Date', value: fmtDate(go.goDate) },
    { label: 'Required Delivery Date', value: fmtDate(go.requiredDeliveryDate) },
    { label: 'Plant / Location', value: go.plant || '-' },
    { label: 'Status', value: go.status },
  ];

  const renderLineQtyEditor = (line) => (
    <TextField
      size="small" type="number" value={getLineValue(line, 'orderQty')}
      onChange={(e) => setLineValue(line, 'orderQty', e.target.value)}
      sx={{ width: 90 }} disabled={go.status === 'Completed'}
    />
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Order Generation Options"
        subtitle="Review the Production and Purchase Orders to be generated from this Generation Order."
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2.5}>
            {headerInfo.map((f) => (
              <Grid item xs={6} sm={4} md={12 / headerInfo.length} key={f.label}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{f.label}</Typography>
                {f.isSourceChip ? (
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
                    <Avatar sx={{ bgcolor: 'warning.main', width: 22, height: 22 }}>
                      <AssignmentOutlinedIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                    <Typography variant="body2" fontWeight={600}>{f.value}</Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" fontWeight={600}>{f.value}</Typography>
                )}
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8.5}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 28, height: 28, fontSize: 14 }}>1</Avatar>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>Order Preview &amp; Exceptions</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Review the lines of this Generation Order. You can edit order quantity before generating.
                  </Typography>
                </Box>
              </Stack>

              <Tabs
                value={activeTab} onChange={(e, v) => setActiveTab(v)}
                variant="scrollable" scrollButtons="auto"
                sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}
              >
                <Tab value="production" icon={<PrecisionManufacturingIcon fontSize="small" />} iconPosition="start" label={`Production Orders (${productionLines.length})`} />
                <Tab value="purchase" icon={<ShoppingCartIcon fontSize="small" />} iconPosition="start" label={`Purchase Orders (${purchaseLines.length})`} />
                <Tab value="subcontracting" icon={<GroupsIcon fontSize="small" />} iconPosition="start" label="Subcontracting Orders (0)" />
                <Tab value="jobwork" icon={<BuildIcon fontSize="small" />} iconPosition="start" label="Job Work Orders (0)" />
              </Tabs>

              {activeTab === 'production' && (
                productionLines.length === 0 ? (
                  <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                    <InsertDriveFileOutlinedIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">No Production Order lines in this Generation Order.</Typography>
                  </Stack>
                ) : (
                  <ScrollableTableContainer maxHeight="none">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>S.No</TableCell>
                          <TableCell>FG Item Code</TableCell>
                          <TableCell>FG Description</TableCell>
                          <TableCell align="right">Required Qty</TableCell>
                          <TableCell align="right">Order Qty</TableCell>
                          <TableCell>UOM</TableCell>
                          <TableCell>Due Date</TableCell>
                          <TableCell>Priority</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {productionLines.map((l, idx) => (
                          <TableRow key={l.id} hover>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{l.productCode}</Typography></TableCell>
                            <TableCell>{l.productName || '-'}</TableCell>
                            <TableCell align="right">{numberFmt(l.requiredQty)}</TableCell>
                            <TableCell align="right">{renderLineQtyEditor(l)}</TableCell>
                            <TableCell>{l.uom || '-'}</TableCell>
                            <TableCell>{fmtDate(l.dueDate)}</TableCell>
                            <TableCell>{l.priority}</TableCell>
                            <TableCell>
                              {l.resultOrderNo
                                ? <Chip size="small" label={`PO ${l.resultOrderNo}`} color="success" variant="outlined" />
                                : <Chip size="small" label="Pending" variant="outlined" />}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                )
              )}

              {activeTab === 'purchase' && (
                purchaseLines.length === 0 ? (
                  <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                    <InsertDriveFileOutlinedIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">No Purchase Order lines in this Generation Order.</Typography>
                  </Stack>
                ) : (
                  <ScrollableTableContainer maxHeight="none">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>S.No</TableCell>
                          <TableCell>Item Code</TableCell>
                          <TableCell>Item Description</TableCell>
                          <TableCell align="right">Required Qty</TableCell>
                          <TableCell align="right">Order Qty</TableCell>
                          <TableCell>UOM</TableCell>
                          <TableCell>Vendor</TableCell>
                          <TableCell>Due Date</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {purchaseLines.map((l, idx) => (
                          <TableRow key={l.id} hover>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{l.productCode}</Typography></TableCell>
                            <TableCell>{l.productName || '-'}</TableCell>
                            <TableCell align="right">{numberFmt(l.requiredQty)}</TableCell>
                            <TableCell align="right">{renderLineQtyEditor(l)}</TableCell>
                            <TableCell>{l.uom || '-'}</TableCell>
                            <TableCell>{l.vendorCode || <Typography variant="caption" color="warning.main">Not set</Typography>}</TableCell>
                            <TableCell>{fmtDate(l.dueDate)}</TableCell>
                            <TableCell>
                              {l.resultOrderNo
                                ? <Chip size="small" label={`PO ${l.resultOrderNo}`} color="success" variant="outlined" />
                                : <Chip size="small" label="Pending" variant="outlined" />}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollableTableContainer>
                )
              )}

              {activeTab === 'subcontracting' && (
                <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                  <Typography variant="body2" color="text.secondary">Subcontracting Orders are not available yet in this system.</Typography>
                </Stack>
              )}
              {activeTab === 'jobwork' && (
                <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 3 }}>
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                  <Typography variant="body2" color="text.secondary">Job Work Orders are not available yet in this system.</Typography>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={3.5}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <BarChartIcon fontSize="small" color="action" />
                <Typography variant="subtitle1" fontWeight={700}>Summary</Typography>
              </Stack>
              <Grid container spacing={1.5}>
                {summary.map((c) => {
                  const Icon = c.icon;
                  return (
                    <Grid item xs={6} key={c.key}>
                      <Card variant="outlined" sx={{ height: '100%', opacity: c.disabled ? 0.6 : 1 }}>
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Avatar sx={{ bgcolor: c.color, width: 32, height: 32, mb: 1 }}>
                            <Icon sx={{ fontSize: 18 }} />
                          </Avatar>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{c.label}{c.disabled ? ' (n/a)' : ''}</Typography>
                          <Typography variant="caption" color="text.secondary">{c.items} Items</Typography>
                          <Typography variant="h6" fontWeight={700}>{numberFmt(c.qty)}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2, bgcolor: 'rgba(255, 152, 0, 0.06)', borderColor: 'warning.light' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <WarningAmberIcon fontSize="small" color="warning" />
                <Typography variant="subtitle2" fontWeight={700}>Validation Messages</Typography>
              </Stack>
              <Stack spacing={0.75}>
                {validationMessages.length === 0 && (
                  <Typography variant="caption" color="text.secondary">No issues found.</Typography>
                )}
                {validationMessages.map((m, idx) => (
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

      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/production-planning/generate-order-mrp')}>Back</Button>
        <Box sx={{ flex: 1 }} />
        {Object.keys(edits).length > 0 && (
          <Button variant="outlined" onClick={handleSaveEdits}>Save Changes</Button>
        )}
        <Button
          variant="contained" color="warning" startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <SettingsSuggestIcon />}
          onClick={handleGenerate} disabled={generating || go.status === 'Completed' || lines.length === 0}
        >
          {go.status === 'Completed' ? 'Orders Already Generated' : 'Generate Orders'}
        </Button>
      </Stack>
    </Box>
  );
}
