import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, Table, TableHead, TableBody, TableRow, TableCell, Avatar, CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsightsIcon from '@mui/icons-material/Insights';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { useListForecastPlansQuery, useGetForecastPlanQuery, useCreateGenerationOrderMutation } from '../../features/productionPlanningApi';
import { isDemoMode } from '../../lib/demoMode';
import { DEMO_FORECAST_PLANS, DEMO_FORECAST_PLAN_DETAIL } from '../../lib/demoData/forecast';
import { DEMO_GO_ID } from '../../lib/demoData/generationOrder';

// ---------------------------------------------------------------------------
// Generate Order - Forecast — Phase 1 (MRP & Order Generation), approved
// scope. Lists real saved Forecast Plans (Production Planning > Forecast,
// already built and real — GET /production-planning/forecast-plans) and
// converts the selected lines' totalForecast quantity directly into a
// Generation Order (sourceType: 'Forecast', sourceForecastPlanId set) — a
// direct forecast-to-order conversion, not MRP netting against current
// stock/open orders (that combination is what Generate Order - MRP already
// does, via forecastDemand() in mrpService.js).
// ---------------------------------------------------------------------------

const METHODS = [
  { key: 'mrp', path: '/production-planning/generate-order-mrp', label: 'MRP', desc: 'Based on MRP planned requirements', icon: AssignmentOutlinedIcon, color: '#e65100' },
  { key: 'manual', path: '/production-planning/generate-order-manual', label: 'Manual', desc: 'Manually select FG items', icon: TouchAppIcon, color: '#1565c0' },
  { key: 'sales-order', path: '/production-planning/generate-order-sales-order', label: 'Sales Order', desc: 'Based on open Sales Order quantity', icon: DescriptionOutlinedIcon, color: '#2e7d32' },
  { key: 'forecast', path: '/production-planning/generate-order-forecast', label: 'Forecast', desc: 'Based on forecast / planned demand', icon: InsightsIcon, color: '#6a1b9a' },
  { key: 'project', path: '/production-planning/generate-order-project', label: 'Project', desc: 'Based on project / job requirement (not yet available)', icon: WorkOutlineIcon, color: '#00695c', disabled: true },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function GenerateOrderForecast() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [goDate, setGoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [requiredDate, setRequiredDate] = useState('');
  const [plant, setPlant] = useState('');
  const [notes, setNotes] = useState('');

  const { data: realPlans = [] } = useListForecastPlansQuery(undefined, { skip: isDemoMode() });
  const plans = isDemoMode() ? DEMO_FORECAST_PLANS : realPlans;
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  useEffect(() => { if (!selectedPlanId && plans.length > 0) setSelectedPlanId(plans[0].id); }, [plans, selectedPlanId]);

  const { data: realPlan, isLoading: loadingPlanReal } = useGetForecastPlanQuery(selectedPlanId, { skip: !selectedPlanId || isDemoMode() });
  const plan = isDemoMode() ? DEMO_FORECAST_PLAN_DETAIL : realPlan;
  const loadingPlan = isDemoMode() ? false : loadingPlanReal;
  const lines = useMemo(() => (plan?.lines || []).filter((l) => l.included !== false && Number(l.totalForecast) > 0), [plan]);

  const [selected, setSelected] = useState(() => new Set());
  const [qtyById, setQtyById] = useState({});
  const [createGo, { isLoading: creatingGo }] = useCreateGenerationOrderMutation();

  useEffect(() => { setSelected(new Set()); setQtyById({}); }, [selectedPlanId]);

  const allSelected = lines.length > 0 && lines.every((l) => selected.has(l.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) lines.forEach((l) => next.delete(l.id));
      else lines.forEach((l) => next.add(l.id));
      return next;
    });
  };
  const toggleRow = (line) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(line.id)) next.delete(line.id);
      else {
        next.add(line.id);
        if (!(line.id in qtyById)) setQtyById((p) => ({ ...p, [line.id]: line.totalForecast }));
      }
      return next;
    });
  };

  const selectedLines = lines.filter((l) => selected.has(l.id));

  const handleGenerate = async () => {
    if (selectedLines.length === 0) {
      notify.error('Select at least one forecast line first');
      return;
    }
    if (isDemoMode()) {
      notify.success('Orders generated');
      navigate(`/production-planning/generate-order?goId=${DEMO_GO_ID}`);
      return;
    }
    try {
      const go = await createGo({
        sourceType: 'Forecast',
        sourceForecastPlanId: selectedPlanId,
        goDate,
        requiredDeliveryDate: requiredDate || null,
        plant: plant || null,
        notes,
        lines: selectedLines.map((l) => ({
          productCode: l.productCode,
          productName: l.productName,
          uom: l.uom,
          requiredQty: l.totalForecast,
          orderQty: qtyById[l.id] || l.totalForecast,
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
          const active = m.key === 'forecast';
          return (
            <Grid item xs={12} sm={6} md={2.4} key={m.key}>
              <Card
                variant="outlined"
                onClick={() => !active && !m.disabled && navigate(m.path)}
                sx={{
                  cursor: active || m.disabled ? 'default' : 'pointer', height: '100%', opacity: m.disabled ? 0.6 : 1,
                  borderColor: active ? 'secondary.main' : 'divider', borderWidth: active ? 2 : 1,
                  bgcolor: active ? 'rgba(106, 27, 154, 0.06)' : 'background.paper',
                }}
              >
                <CardContent>
                  <Avatar sx={{ bgcolor: m.color, width: 40, height: 40 }}><Icon fontSize="small" /></Avatar>
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Step 1: Forecast Plan Selection &amp; GO Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Forecast Plan"
                value={selectedPlanId || ''} onChange={(e) => setSelectedPlanId(Number(e.target.value))}
              >
                {plans.map((p) => <MenuItem key={p.id} value={p.id}>{p.planNo} — {p.planName}</MenuItem>)}
                {plans.length === 0 && <MenuItem value="" disabled>No saved Forecast Plans</MenuItem>}
              </TextField>
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
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={700}>Step 2: Select Forecast Lines</Typography>
            <Chip size="small" label={selected.size} color="primary" />
          </Stack>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 3, pb: 1.5 }}>
          <Checkbox size="small" checked={allSelected} onChange={toggleAll} disabled={lines.length === 0} />
          <Typography variant="body2" color="text.secondary">Select All</Typography>
        </Stack>

        {loadingPlan ? (
          <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
        ) : lines.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {plans.length === 0 ? 'No saved Forecast Plans yet — create one under Production Planning > Forecast.' : 'This plan has no included lines with forecast quantity.'}
            </Typography>
          </Box>
        ) : (
          <ScrollableTableContainer maxHeight="clamp(240px, calc(100vh - 560px), 420px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Forecast Qty</TableCell>
                  <TableCell align="right">Order Qty</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((l, idx) => (
                  <TableRow key={l.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.has(l.id)} onChange={() => toggleRow(l)} />
                    </TableCell>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{l.productCode}</Typography></TableCell>
                    <TableCell>{l.productName || '-'}</TableCell>
                    <TableCell>{l.uom || '-'}</TableCell>
                    <TableCell align="right">{numberFmt(l.totalForecast)}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" type="number" value={qtyById[l.id] ?? l.totalForecast}
                        onChange={(e) => setQtyById((p) => ({ ...p, [l.id]: e.target.value }))}
                        sx={{ width: 90 }} inputProps={{ style: { textAlign: 'right' } }}
                        disabled={!selected.has(l.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        )}
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>
            Step 3: Order Generation Preview ({selected.size} Line{selected.size === 1 ? '' : 's'} Selected)
          </Typography>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
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
