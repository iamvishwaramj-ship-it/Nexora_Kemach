import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  Avatar, CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InsightsIcon from '@mui/icons-material/Insights';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import SearchIcon from '@mui/icons-material/Search';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { useListOpenSalesOrderLinesQuery, useCreateGenerationOrderMutation } from '../../features/productionPlanningApi';
import { isDemoMode } from '../../lib/demoMode';
import { DEMO_OPEN_SALES_ORDER_LINES } from '../../lib/demoData/productionPlanning';
import { DEMO_GO_ID } from '../../lib/demoData/generationOrder';

// ---------------------------------------------------------------------------
// Generate Order - Sales Order — Phase 1 (MRP & Order Generation), approved
// scope. Lists real open Sales Order lines (GET /production-planning/open-
// sales-order-lines — mrpService.listOpenSalesOrderLines: quantity minus
// deliveredQuantity, on orders not Draft/Cancelled/Delivered) and converts
// the selected lines directly into a Generation Order (sourceType:
// 'SalesOrder') — a straight order-to-order conversion, not MRP netting, per
// the screen's own description. Order type (Production/Purchase) is
// resolved server-side in createGenerationOrder from each product's BOM/
// default supplier, same as every other Generate Order entry screen.
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
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

export default function GenerateOrderSalesOrder() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [goDate, setGoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [requiredDate, setRequiredDate] = useState('');
  const [plant, setPlant] = useState('');
  const [notes, setNotes] = useState('');

  const { data: realLines = [], isLoading: isLoadingReal } = useListOpenSalesOrderLinesQuery(undefined, { skip: isDemoMode() });
  const lines = isDemoMode() ? DEMO_OPEN_SALES_ORDER_LINES : realLines;
  const isLoading = isDemoMode() ? false : isLoadingReal;
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [selectQtyById, setSelectQtyById] = useState({});
  const [createGo, { isLoading: creatingGo }] = useCreateGenerationOrderMutation();

  const rows = useMemo(() => lines.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (r.orderNo || '').toLowerCase().includes(q) || (r.customer || '').toLowerCase().includes(q) || (r.productCode || '').toLowerCase().includes(q);
  }), [lines, search]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const toggleRow = (id, openQty) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        if (!(id in selectQtyById)) setSelectQtyById((p) => ({ ...p, [id]: openQty }));
      }
      return next;
    });
  };

  const selectedLines = lines.filter((l) => selected.has(l.id));

  const handleGenerate = async () => {
    if (selectedLines.length === 0) {
      notify.error('Select at least one Sales Order line first');
      return;
    }
    if (isDemoMode()) {
      notify.success('Orders generated');
      navigate(`/production-planning/generate-order?goId=${DEMO_GO_ID}`);
      return;
    }
    try {
      const go = await createGo({
        sourceType: 'SalesOrder',
        goDate,
        requiredDeliveryDate: requiredDate || null,
        plant: plant || null,
        notes,
        lines: selectedLines.map((l) => ({
          productCode: l.productCode,
          productName: l.productName,
          uom: l.uom,
          requiredQty: l.openQty,
          orderQty: selectQtyById[l.id] || l.openQty,
          dueDate: l.deliveryDate,
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
          const active = m.key === 'sales-order';
          return (
            <Grid item xs={12} sm={6} md={2.4} key={m.key}>
              <Card
                variant="outlined"
                onClick={() => !active && !m.disabled && navigate(m.path)}
                sx={{
                  cursor: active || m.disabled ? 'default' : 'pointer', height: '100%', opacity: m.disabled ? 0.6 : 1,
                  borderColor: active ? 'success.main' : 'divider', borderWidth: active ? 2 : 1,
                  bgcolor: active ? 'rgba(46, 125, 50, 0.06)' : 'background.paper',
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Step 1: Sales Order Selection &amp; GO Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" type="date" label="GO Date" value={goDate} onChange={(e) => setGoDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" type="date" label="Required Delivery Date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" label="Plant / Location" value={plant} onChange={(e) => setPlant(e.target.value)} placeholder="Main Plant" />
            </Grid>
            <Grid item xs={12} sm={6} md={4.8}>
              <TextField fullWidth size="small" label="Notes" placeholder="Enter remarks..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={700}>Step 2: Select Open Sales Order Lines</Typography>
            <Chip size="small" label={selected.size} color="primary" />
          </Stack>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 3, pb: 1.5 }} flexWrap="wrap" useFlexGap>
          <Checkbox size="small" checked={allSelected} onChange={toggleAll} disabled={rows.length === 0} />
          <Typography variant="body2" color="text.secondary">Select All</Typography>
          <TextField
            size="small" placeholder="Search Sales Order, Customer, Item..." value={search}
            onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 280, ml: 'auto' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
        </Stack>

        {isLoading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No open Sales Order lines found.</Typography>
          </Box>
        ) : (
          <ScrollableTableContainer maxHeight="clamp(240px, calc(100vh - 480px), 480px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell>Sales Order No.</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Delivery Date</TableCell>
                  <TableCell align="right">Open Qty</TableCell>
                  <TableCell align="right">Select Qty</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={r.id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.has(r.id)} onChange={() => toggleRow(r.id, r.openQty)} />
                    </TableCell>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.orderNo}</Typography></TableCell>
                    <TableCell>{r.customer || '-'}</TableCell>
                    <TableCell>{r.productCode}</TableCell>
                    <TableCell>{r.productName || '-'}</TableCell>
                    <TableCell>{fmtDate(r.deliveryDate)}</TableCell>
                    <TableCell align="right">{numberFmt(r.openQty)}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" type="number" value={selectQtyById[r.id] ?? r.openQty}
                        onChange={(e) => setSelectQtyById((p) => ({ ...p, [r.id]: e.target.value }))}
                        sx={{ width: 90 }} inputProps={{ style: { textAlign: 'right' }, max: r.openQty }}
                        disabled={!selected.has(r.id)}
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
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
            <PrecisionManufacturingIcon color="action" />
            <Typography variant="caption" color="text.secondary">
              Order type (Production or Purchase) is decided automatically when the orders are generated, based on each item's BOM and default supplier.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
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
