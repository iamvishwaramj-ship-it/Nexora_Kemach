import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Autocomplete, Alert,
} from '@mui/material';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import { useNotify } from '../../../components/feedback/NotificationProvider';
import { productApi, branchApi, warehouseApi } from '../../../features/resources';
import { bomApi, routingApi, productionOrderApi } from '../../../features/productionApi';
import { isDemoMode } from '../../../lib/demoMode';
import { withDemoCrud } from '../../../lib/demoCrud';
import {
  DEMO_PRODUCTS, DEMO_BRANCHES, DEMO_WAREHOUSES, DEMO_BOMS, DEMO_ROUTINGS, DEMO_PRODUCTION_ORDERS,
} from '../../../lib/demoData/productionPlanning';

// Demo-mode-aware api: a pure pass-through to the real productionOrderApi
// when demo mode is off (see ../../../lib/demoMode.js). Shares the same
// DEMO_PRODUCTION_ORDERS array reference as ProductionOrders.jsx and
// ViewOrder.jsx, so a demo-created order shows up live in those screens.
const demoAwareProductionOrderApi = withDemoCrud(productionOrderApi, DEMO_PRODUCTION_ORDERS);

// Production Execution > Create Production Order — Phase A manufacturing
// foundation. Unlike the other Production Execution "Create ..." screens
// (Create Issue, Create Requisition), there is a real backing model and API
// here (schema.prisma's ProductionOrder / routes/productionOrders.js), so
// this form actually submits: POST /api/production/orders snapshots the
// chosen (or default) BOM's component lines and the chosen (or default)
// routing's operations onto the new order.

export default function CreateProductionOrder() {
  const navigate = useNavigate();
  const notify = useNotify();
  const { data: realProducts } = productApi.useList(undefined, { skip: isDemoMode() });
  const { data: realBranches } = branchApi.useList(undefined, { skip: isDemoMode() });
  const { data: realWarehouses } = warehouseApi.useList(undefined, { skip: isDemoMode() });
  const { data: realBoms } = bomApi.useList(undefined, { skip: isDemoMode() });
  const { data: realRoutings } = routingApi.useList(undefined, { skip: isDemoMode() });
  const products = isDemoMode() ? DEMO_PRODUCTS : realProducts;
  const branches = isDemoMode() ? DEMO_BRANCHES : realBranches;
  const warehouses = isDemoMode() ? DEMO_WAREHOUSES : realWarehouses;
  const boms = isDemoMode() ? DEMO_BOMS : realBoms;
  const routings = isDemoMode() ? DEMO_ROUTINGS : realRoutings;
  const [createOrderReal, { isLoading: savingReal }] = productionOrderApi.useCreate();
  const [createOrderDemo, { isLoading: savingDemo }] = demoAwareProductionOrderApi.useCreate();
  const saving = isDemoMode() ? savingDemo : savingReal;

  const [productCode, setProductCode] = useState('');
  const [orderQty, setOrderQty] = useState('');
  const [bomId, setBomId] = useState('');
  const [routingId, setRoutingId] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [branch, setBranch] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const selectedProduct = (products || []).find((p) => p.productCode === productCode) || null;
  const bomsForProduct = useMemo(() => (boms || []).filter((b) => b.productCode === productCode && b.status === 'Active'), [boms, productCode]);
  const routingsForProduct = useMemo(() => (routings || []).filter((r) => r.productCode === productCode && r.status === 'Active'), [routings, productCode]);
  const defaultBom = bomsForProduct.find((b) => b.isDefault);

  const handleSubmit = async () => {
    setError('');
    if (!productCode) { setError('Select a finished product'); return; }
    const qty = Number(orderQty);
    if (!Number.isFinite(qty) || qty <= 0) { setError('Enter a valid order quantity'); return; }
    if (!bomId && !defaultBom) { setError('No default active BOM for this product — select one explicitly'); return; }

    if (isDemoMode()) {
      const chosenBom = bomsForProduct.find((b) => b.id === bomId) || defaultBom || null;
      const chosenRouting = routingsForProduct.find((r) => r.id === routingId) || routingsForProduct.find((r) => r.isDefault) || null;
      const orderNo = `PO-2026-DEMO-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const order = {
        productCode,
        productName: selectedProduct?.productName || '',
        uom: selectedProduct?.uom || '',
        orderQty: qty,
        status: 'Planned',
        isCancelled: false,
        orderNo,
        plannedStartDate: plannedStartDate || null,
        dueDate: dueDate || null,
        warehouse: warehouse || null,
        branch: branch || null,
        notes: notes || '',
        bom: chosenBom ? { bomCode: chosenBom.bomCode, version: chosenBom.version } : null,
        routing: chosenRouting ? { routingCode: chosenRouting.routingCode, version: chosenRouting.version } : null,
        baseType: null,
        baseNo: null,
        components: (chosenBom?.lines || []).map((l) => ({
          id: l.id,
          componentProductCode: l.componentProductCode,
          componentProductName: l.componentProductName,
          uom: l.uom,
          plannedQty: Number(l.quantityPer) * qty,
          issuedQty: 0,
        })),
        operations: chosenRouting?.operations || [],
        createdByName: 'Demo User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        const created = await createOrderDemo(order).unwrap();
        notify.success(`Production order ${created.orderNo} created`);
        navigate(`/production-execution/view-order/${created.id}`);
      } catch (err) {
        notify.error('Could not create production order');
      }
      return;
    }

    try {
      const order = await createOrderReal({
        productCode,
        orderQty: qty,
        bomId: bomId || undefined,
        routingId: routingId || undefined,
        plannedStartDate: plannedStartDate || undefined,
        dueDate: dueDate || undefined,
        warehouse: warehouse || undefined,
        branch: branch || undefined,
        notes: notes || undefined,
      }).unwrap();
      notify.success(`Production order ${order.orderNo} created`);
      navigate(`/production-execution/view-order/${order.id}`);
    } catch (err) {
      notify.error(err?.data?.message || 'Could not create production order');
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<NoteAddIcon />}
        title="Create Production Order"
        subtitle="Create a production order for a finished product. Its BOM and routing are snapshotted onto the order at the moment it's created."
      />

      <Card variant="outlined" sx={{ mb: 2.5 }}>
        <CardContent>
          {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                size="small"
                options={products || []}
                getOptionLabel={(o) => (typeof o === 'string' ? o : `${o.productCode} - ${o.productName || ''}`)}
                value={selectedProduct}
                isOptionEqualToValue={(o, v) => o.productCode === v.productCode}
                onChange={(e, val) => { setProductCode(val?.productCode || ''); setBomId(''); setRoutingId(''); }}
                renderInput={(params) => <TextField {...params} required label="Finished Product" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" required type="number" label="Order Quantity"
                value={orderQty} onChange={(e) => setOrderQty(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="BOM"
                value={bomId} onChange={(e) => setBomId(e.target.value)}
                helperText={!bomId && defaultBom ? `Defaults to ${defaultBom.bomCode} (${defaultBom.version})` : ' '}
                disabled={!productCode}
              >
                <MenuItem value="">{defaultBom ? `(Default) ${defaultBom.bomCode}` : 'Select a BOM'}</MenuItem>
                {bomsForProduct.map((b) => <MenuItem key={b.id} value={b.id}>{b.bomCode} ({b.version})</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Routing (optional)"
                value={routingId} onChange={(e) => setRoutingId(e.target.value)}
                disabled={!productCode}
              >
                <MenuItem value="">None</MenuItem>
                {routingsForProduct.map((r) => <MenuItem key={r.id} value={r.id}>{r.routingCode} ({r.version})</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" type="date" label="Planned Start Date"
                value={plannedStartDate} onChange={(e) => setPlannedStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" type="date" label="Due Date"
                value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Warehouse" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
                <MenuItem value="">-</MenuItem>
                {(warehouses || []).map((w) => (
                  <MenuItem key={w.id} value={w.warehouseName || w.name}>{w.warehouseName || w.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)}>
                <MenuItem value="">-</MenuItem>
                {(branches || []).map((b) => <MenuItem key={b.id} value={b.branchName}>{b.branchName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth size="small" multiline minRows={2} label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/production-execution/production-orders')}>
          Back to List
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={handleSubmit} disabled={saving}>
          Create Production Order
        </Button>
      </Stack>
    </Box>
  );
}
