import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  Avatar, Accordion, AccordionSummary, AccordionDetails,
  ToggleButtonGroup, ToggleButton, CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsightsIcon from '@mui/icons-material/Insights';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GroupsIcon from '@mui/icons-material/Groups';
import BuildIcon from '@mui/icons-material/Build';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import RefreshIcon from '@mui/icons-material/Refresh';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useNotify } from '../../components/feedback/NotificationProvider';
import {
  useListMrpRunsQuery, useRunMrpMutation, useGetMrpRunQuery, useLazyGetMrpItemDetailQuery,
  useCreateGenerationOrderMutation,
} from '../../features/productionPlanningApi';

// ---------------------------------------------------------------------------
// Generate Order - MRP — Phase 1 (MRP & Order Generation), explicitly
// approved scope. Real MRP run data from POST/GET /production-planning/
// mrp-runs (backend/src/services/mrpService.js) replaces the earlier static
// mock. Subcontracting/Job Work order generation is not available in this
// phase (approved decision 1) — their cards below are shown disabled rather
// than removed or simulated.
// ---------------------------------------------------------------------------

const METHODS = [
  { key: 'mrp', path: '/production-planning/generate-order-mrp', label: 'MRP', desc: 'Based on MRP planned requirements', icon: AssignmentOutlinedIcon, color: '#e65100' },
  { key: 'manual', path: '/production-planning/generate-order-manual', label: 'Manual', desc: 'Manually select FG items', icon: TouchAppIcon, color: '#1565c0' },
  { key: 'sales-order', path: '/production-planning/generate-order-sales-order', label: 'Sales Order', desc: 'Based on open Sales Order quantity', icon: DescriptionOutlinedIcon, color: '#2e7d32' },
  { key: 'forecast', path: '/production-planning/generate-order-forecast', label: 'Forecast', desc: 'Based on forecast / planned demand', icon: InsightsIcon, color: '#6a1b9a' },
  { key: 'project', path: '/production-planning/generate-order-project', label: 'Project', desc: 'Based on project / job requirement (not yet available)', icon: WorkOutlineIcon, color: '#00695c', disabled: true },
];

const ORDER_TYPE_META = { Production: { color: 'info', label: 'Production Order' }, Purchase: { color: 'warning', label: 'Purchase Order' }, Unclassified: { color: 'default', label: 'Unclassified' } };

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}
function monthStr(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function GenerateOrderMrp() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [goDate, setGoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [requiredDate, setRequiredDate] = useState('');
  const [plant, setPlant] = useState('');
  const [notes, setNotes] = useState('');

  const { data: runs = [] } = useListMrpRunsQuery();
  const [selectedRunId, setSelectedRunId] = useState(null);
  useEffect(() => { if (!selectedRunId && runs.length > 0) setSelectedRunId(runs[0].id); }, [runs, selectedRunId]);

  const [runMrp, { isLoading: running }] = useRunMrpMutation();
  const { data: run, isLoading: loadingRun } = useGetMrpRunQuery(selectedRunId, { skip: !selectedRunId });
  const requirements = run?.requirements || [];

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [activeItem, setActiveItem] = useState(null);
  const [panelTab, setPanelTab] = useState('bom');
  const [expanded, setExpanded] = useState('routing');

  const [fetchDetail, { data: detail, isFetching: loadingDetail }] = useLazyGetMrpItemDetailQuery();
  useEffect(() => {
    if (activeItem && selectedRunId) fetchDetail({ runId: selectedRunId, productCode: activeItem });
  }, [activeItem, selectedRunId, fetchDetail]);

  const [createGo, { isLoading: creatingGo }] = useCreateGenerationOrderMutation();

  const rows = requirements.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.productCode.toLowerCase().includes(q) || (r.productName || '').toLowerCase().includes(q);
  });

  useEffect(() => {
    if (!activeItem && rows.length > 0) setActiveItem(rows[0].productCode);
  }, [rows, activeItem]);

  const eligibleRows = rows.filter((r) => Number(r.netToGenerate) > 0 && r.suggestedOrderType !== 'Unclassified' && !r.coveredByGoNo);
  const allSelected = eligibleRows.length > 0 && eligibleRows.every((r) => selected.has(r.productCode));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) eligibleRows.forEach((r) => next.delete(r.productCode));
      else eligibleRows.forEach((r) => next.add(r.productCode));
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

  const summary = {
    total: requirements.length,
    covered: requirements.filter((r) => Number(r.netToGenerate) <= 0).length,
    inProgress: requirements.filter((r) => Number(r.inProgressQty) > 0).length,
    net: requirements.reduce((s, r) => s + Number(r.netToGenerate || 0), 0),
  };

  const selectedRows = requirements.filter((r) => selected.has(r.productCode));
  const previewCards = useMemo(() => {
    const groups = { production: { items: 0, qty: 0 }, purchase: { items: 0, qty: 0 } };
    selectedRows.forEach((r) => {
      const key = r.suggestedOrderType === 'Production' ? 'production' : r.suggestedOrderType === 'Purchase' ? 'purchase' : null;
      if (!key) return;
      groups[key].items += 1;
      groups[key].qty += Number(r.netToGenerate || 0);
    });
    return [
      { key: 'production', label: 'Production Orders', icon: PrecisionManufacturingIcon, color: 'info', ...groups.production },
      { key: 'purchase', label: 'Purchase Orders', icon: ShoppingCartIcon, color: 'warning', ...groups.purchase },
      { key: 'subcontracting', label: 'Subcontracting Orders', icon: GroupsIcon, color: 'secondary', items: 0, qty: 0, disabled: true },
      { key: 'jobwork', label: 'Job Work Orders', icon: BuildIcon, color: 'success', items: 0, qty: 0, disabled: true },
    ];
  }, [selectedRows]);

  const handleRunMrp = async () => {
    try {
      const result = await runMrp({
        horizonFromMonth: monthStr(0),
        horizonToMonth: monthStr(5),
        plant: plant || null,
      }).unwrap();
      setSelectedRunId(result.id);
      setSelected(new Set());
      notify.success(`MRP run ${result.runCode} completed — ${result.requirements.length} item(s) with open demand`);
    } catch (err) {
      notify.error(err?.data?.message || 'Could not run MRP');
    }
  };

  const handleGenerate = async () => {
    if (selectedRows.length === 0) {
      notify.error('Select at least one item first');
      return;
    }
    const unclassified = selectedRows.filter((r) => r.suggestedOrderType === 'Unclassified');
    if (unclassified.length > 0) {
      notify.error(`${unclassified[0].productCode} has no active BOM and no default supplier — remove it or fix its master data first`);
      return;
    }
    try {
      const go = await createGo({
        sourceType: 'MRP',
        sourceRunId: selectedRunId,
        goDate,
        requiredDeliveryDate: requiredDate || null,
        plant: plant || null,
        notes,
        lines: selectedRows.map((r) => ({
          productCode: r.productCode,
          productName: r.productName,
          uom: r.uom,
          requiredQty: r.netToGenerate,
          orderQty: r.netToGenerate,
          orderType: r.suggestedOrderType,
          dueDate: r.requiredDate,
        })),
      }).unwrap();
      navigate(`/production-planning/order-generation-option?goId=${go.id}`);
    } catch (err) {
      notify.error(err?.data?.message || 'Could not create Generation Order');
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Generate Order"
        subtitle="Create Production and Purchase Orders from MRP, Manual selection, Sales Order or Forecast. (Subcontracting and Job Work order generation are not available yet.)"
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = m.key === 'mrp';
          return (
            <Grid item xs={12} sm={6} md={2.4} key={m.key}>
              <Card
                variant="outlined"
                onClick={() => !active && !m.disabled && navigate(m.path)}
                sx={{
                  cursor: active || m.disabled ? 'default' : 'pointer', height: '100%', opacity: m.disabled ? 0.6 : 1,
                  borderColor: active ? 'warning.main' : 'divider', borderWidth: active ? 2 : 1,
                  bgcolor: active ? 'rgba(255, 152, 0, 0.06)' : 'background.paper',
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Avatar sx={{ bgcolor: m.color, width: 40, height: 40 }}><Icon fontSize="small" /></Avatar>
                  </Stack>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>{m.label}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', minHeight: 32 }}>{m.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Step 1: MRP Selection &amp; GO Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="MRP Run"
                value={selectedRunId || ''} onChange={(e) => { setSelectedRunId(Number(e.target.value)); setSelected(new Set()); }}
              >
                {runs.map((r) => <MenuItem key={r.id} value={r.id}>{r.runCode} ({new Date(r.runDate).toLocaleDateString('en-GB')})</MenuItem>)}
                {runs.length === 0 && <MenuItem value="" disabled>No MRP runs yet — click Run MRP</MenuItem>}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button fullWidth variant="outlined" startIcon={running ? <CircularProgress size={16} /> : <RefreshIcon />} onClick={handleRunMrp} disabled={running}>
                Run MRP
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" type="date" label="GO Date" value={goDate} onChange={(e) => setGoDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" type="date" label="Required Delivery Date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.2}>
              <TextField fullWidth size="small" label="Plant / Location" value={plant} onChange={(e) => setPlant(e.target.value)} placeholder="Main Plant" />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} md={8}>
              <Card variant="outlined" sx={{ height: '100%', bgcolor: 'action.hover' }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>MRP Summary (for selected run)</Typography>
                  <Grid container spacing={2}>
                    {[
                      { label: 'Total Requirements', value: summary.total, color: 'text.primary' },
                      { label: 'Already Covered', value: summary.covered, color: 'success.main' },
                      { label: 'In Progress', value: summary.inProgress, color: 'warning.main' },
                      { label: 'Net to Generate (qty)', value: numberFmt(summary.net), color: 'primary.main' },
                    ].map((s) => (
                      <Grid item xs={6} sm={3} key={s.label}>
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
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>What is considered?</Typography>
                  <Stack spacing={0.75}>
                    {[
                      'Open Sales Order quantity and saved Forecast Plan demand',
                      'Current on-hand stock, open Purchase Orders and open Production Orders',
                      'No stock is reserved and no inventory is changed by this screen',
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

      <Card variant="outlined" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={700}>Step 2: MRP Planned Requirements (Net to Generate)</Typography>
            <Chip size="small" label={eligibleRows.length} color="primary" />
          </Stack>
        </Stack>

        <Grid container>
          <Grid item xs={12} md={8} lg={8.5}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 3, pb: 1.5 }} flexWrap="wrap" useFlexGap>
              <Checkbox size="small" checked={allSelected} onChange={toggleAll} disabled={eligibleRows.length === 0} />
              <Typography variant="body2" color="text.secondary">Select All Eligible</Typography>
              <TextField
                size="small" placeholder="Search item code or description..." value={search}
                onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 260, ml: 'auto' }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Stack>

            {loadingRun ? (
              <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
            ) : rows.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {runs.length === 0 ? 'No MRP run yet — click "Run MRP" above.' : 'This run found no open demand.'}
                </Typography>
              </Box>
            ) : (
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
                      <TableCell align="right">Net Qty to Generate</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell>Required Date</TableCell>
                      <TableCell>Suggested Order Type</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r, idx) => {
                      const eligible = Number(r.netToGenerate) > 0 && r.suggestedOrderType !== 'Unclassified' && !r.coveredByGoNo;
                      return (
                        <TableRow
                          key={r.productCode} hover selected={activeItem === r.productCode}
                          onClick={() => setActiveItem(r.productCode)} sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox size="small" disabled={!eligible} checked={selected.has(r.productCode)} onClick={(e) => e.stopPropagation()} onChange={() => toggleRow(r.productCode)} />
                          </TableCell>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.productCode}</Typography></TableCell>
                          <TableCell>{r.productName || '-'}</TableCell>
                          <TableCell align="right">{numberFmt(r.grossRequirement)}</TableCell>
                          <TableCell align="right">{numberFmt(r.availableQty)}</TableCell>
                          <TableCell align="right">{numberFmt(r.inProgressQty)}</TableCell>
                          <TableCell align="right"><Typography variant="body2" color="primary.main" fontWeight={700}>{numberFmt(r.netToGenerate)}</Typography></TableCell>
                          <TableCell>{r.uom || '-'}</TableCell>
                          <TableCell>{r.requiredDate ? new Date(r.requiredDate).toLocaleDateString('en-GB') : '-'}</TableCell>
                          <TableCell>
                            {r.coveredByGoNo ? (
                              <Chip size="small" label={`Covered by ${r.coveredByGoNo}`} variant="outlined" />
                            ) : (
                              <Chip size="small" label={ORDER_TYPE_META[r.suggestedOrderType]?.label || r.suggestedOrderType} color={ORDER_TYPE_META[r.suggestedOrderType]?.color || 'default'} variant="outlined" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            )}
          </Grid>

          <Grid item xs={12} md={4} lg={3.5}>
            <Box sx={{ p: 2.5, borderLeft: { md: '1px solid' }, borderColor: 'divider', height: '100%' }}>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>
                Item Details ({selected.size} item{selected.size === 1 ? '' : 's'} selected)
              </Typography>

              {!activeItem ? (
                <Typography variant="caption" color="text.secondary">Select a row to see its BOM and Routing.</Typography>
              ) : (
                <>
                  <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
                    <Avatar variant="rounded" sx={{ width: 48, height: 48, bgcolor: 'action.hover' }}>
                      <PrecisionManufacturingIcon color="disabled" />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{activeItem}</Typography>
                    </Box>
                  </Stack>

                  <ToggleButtonGroup size="small" exclusive fullWidth value={panelTab} onChange={(e, v) => v && setPanelTab(v)} sx={{ mb: 1.5 }}>
                    <ToggleButton value="bom">BOM &amp; Routing</ToggleButton>
                  </ToggleButtonGroup>

                  {loadingDetail ? (
                    <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={22} /></Box>
                  ) : !detail?.bom ? (
                    <Typography variant="caption" color="text.secondary">No active BOM for this item — it will generate as a Purchase Order, if it has a default supplier.</Typography>
                  ) : (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        BOM {detail.bom.bomCode} ({detail.bom.components.length} Components)
                      </Typography>
                      <Table size="small">
                        <TableHead>
                          <TableRow><TableCell>Component</TableCell><TableCell align="right">Qty/Unit</TableCell><TableCell>Type</TableCell></TableRow>
                        </TableHead>
                        <TableBody>
                          {detail.bom.components.map((c) => (
                            <TableRow key={c.componentProductCode}>
                              <TableCell>
                                <Typography variant="caption" fontWeight={600}>{c.componentProductCode}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{c.componentProductName}</Typography>
                              </TableCell>
                              <TableCell align="right">{Number(c.quantityPer).toFixed(2)}</TableCell>
                              <TableCell><Chip size="small" label={c.type} color={c.type === 'Make' ? 'success' : c.type === 'Buy' ? 'warning' : 'default'} /></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      <Accordion disableGutters square expanded={expanded === 'routing'} onChange={() => setExpanded(expanded === 'routing' ? '' : 'routing')} sx={{ mt: 1, border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40 }}>
                          <Typography variant="caption" fontWeight={700}>
                            Routing {detail.routing ? `(${detail.routing.operations.length} Operations)` : '(none)'}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          {detail.routing ? (
                            <Stack spacing={0.5}>
                              {detail.routing.operations.map((op) => (
                                <Typography key={op.id} variant="caption" color="text.secondary">
                                  {op.operationNo}. {op.operationName} {op.workCenterCode ? `— ${op.workCenterCode}` : ''}
                                </Typography>
                              ))}
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">No routing assigned to this product.</Typography>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    </>
                  )}
                </>
              )}
            </Box>
          </Grid>
        </Grid>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>
            Step 3: Order Generation Preview ({selected.size} Item{selected.size === 1 ? '' : 's'} Selected)
          </Typography>
          <Grid container spacing={2}>
            {previewCards.map((card) => {
              const Icon = card.icon;
              return (
                <Grid item xs={12} sm={6} md={3} key={card.key}>
                  <Card variant="outlined" sx={{ height: '100%', opacity: card.disabled ? 0.6 : 1 }}>
                    <CardContent>
                      <Avatar sx={{ bgcolor: `${card.color}.main`, width: 40, height: 40, mb: 1 }}><Icon fontSize="small" /></Avatar>
                      <Typography variant="subtitle2" fontWeight={700}>{card.label}{card.disabled ? ' (not available yet)' : ''}</Typography>
                      <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                        <Box><Typography variant="h6" fontWeight={700}>{card.items}</Typography><Typography variant="caption" color="text.secondary">Items</Typography></Box>
                        <Box><Typography variant="h6" fontWeight={700}>{numberFmt(card.qty)}</Typography><Typography variant="caption" color="text.secondary">Qty</Typography></Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained" color="warning" startIcon={creatingGo ? <CircularProgress size={16} color="inherit" /> : <SettingsSuggestIcon />}
              onClick={handleGenerate} disabled={creatingGo || selected.size === 0}
            >
              Review &amp; Generate Orders
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
