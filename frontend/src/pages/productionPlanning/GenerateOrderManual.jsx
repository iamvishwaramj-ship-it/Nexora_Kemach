import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, Button,
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
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GroupsIcon from '@mui/icons-material/Groups';
import BuildIcon from '@mui/icons-material/Build';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { productApi } from '../../features/resources';
import { useCreateGenerationOrderMutation, useLazyGetMrpItemDetailQuery } from '../../features/productionPlanningApi';
import { isDemoMode } from '../../lib/demoMode';
import { DEMO_PRODUCTS, getDemoItemDetail } from '../../lib/demoData/productionPlanning';
import { DEMO_GO_ID } from '../../lib/demoData/generationOrder';

// ---------------------------------------------------------------------------
// Generate Order - Manual — Phase 1 (MRP & Order Generation), approved
// scope. Item list is now the real Product Master (productApi.useList, the
// same source BOM/Routing Master already use), order type/BOM preview comes
// from the real backend (classifyProduct/getItemDetail in
// backend/src/services/mrpService.js, same endpoint the MRP screen's side
// panel uses), and "Review & Generate Orders" creates a real Generation
// Order (sourceType: 'Manual') via POST /production-planning/generation-
// orders. Subcontracting/Job Work order types are not available in this
// phase (approved decision 1) and are not offered here.
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

export default function GenerateOrderManual() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [goDate, setGoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [requiredDate, setRequiredDate] = useState('');
  const [plant, setPlant] = useState('');
  const [notes, setNotes] = useState('');

  const { data: realProducts = [], isLoading: loadingProductsReal } = productApi.useList(undefined, { skip: isDemoMode() });
  const products = isDemoMode() ? DEMO_PRODUCTS : realProducts;
  const loadingProducts = isDemoMode() ? false : loadingProductsReal;
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [qtyByCode, setQtyByCode] = useState({});
  const [dateByCode, setDateByCode] = useState({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [activeItem, setActiveItem] = useState(null);
  const [expanded, setExpanded] = useState('routing');

  const [fetchDetail, { data: realDetail, isFetching: loadingDetail }] = useLazyGetMrpItemDetailQuery();
  const [createGo, { isLoading: creatingGo }] = useCreateGenerationOrderMutation();
  const detail = isDemoMode() ? getDemoItemDetail(activeItem) : realDetail;

  const rows = useMemo(() => products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (p.productCode || '').toLowerCase().includes(q) || (p.productName || '').toLowerCase().includes(q);
  }), [products, search]);

  const pagedRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    if (!activeItem && pagedRows.length > 0) setActiveItem(pagedRows[0].productCode);
  }, [pagedRows, activeItem]);

  useEffect(() => {
    // '0' as a dummy runId — classifyProduct/BOM lookup is independent of any
    // MRP run; getMrpItemDetail just happens to be the existing read-only
    // endpoint for it, same one the MRP screen's side panel calls.
    if (activeItem && !isDemoMode()) fetchDetail({ runId: 0, productCode: activeItem });
  }, [activeItem, fetchDetail]);

  const allSelected = pagedRows.length > 0 && pagedRows.every((r) => selected.has(r.productCode));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pagedRows.forEach((r) => next.delete(r.productCode));
      else pagedRows.forEach((r) => next.add(r.productCode));
      return next;
    });
  };
  const toggleRow = (code) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else {
        next.add(code);
        if (!(code in qtyByCode)) setQtyByCode((p) => ({ ...p, [code]: 1 }));
      }
      return next;
    });
  };

  const selectedProducts = products.filter((p) => selected.has(p.productCode));

  const handleGenerate = async () => {
    if (selectedProducts.length === 0) {
      notify.error('Select at least one item first');
      return;
    }
    const missingQty = selectedProducts.find((p) => !Number(qtyByCode[p.productCode]) || Number(qtyByCode[p.productCode]) <= 0);
    if (missingQty) {
      notify.error(`Enter an order quantity greater than 0 for ${missingQty.productCode}`);
      return;
    }
    if (isDemoMode()) {
      notify.success('Orders generated');
      navigate(`/production-planning/generate-order?goId=${DEMO_GO_ID}`);
      return;
    }
    try {
      const go = await createGo({
        sourceType: 'Manual',
        goDate,
        requiredDeliveryDate: requiredDate || null,
        plant: plant || null,
        notes,
        lines: selectedProducts.map((p) => ({
          productCode: p.productCode,
          productName: p.productName,
          uom: p.uom,
          requiredQty: qtyByCode[p.productCode],
          orderQty: qtyByCode[p.productCode],
          dueDate: dateByCode[p.productCode] || null,
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
          const active = m.key === 'manual';
          return (
            <Grid item xs={12} sm={6} md={2.4} key={m.key}>
              <Card
                variant="outlined"
                onClick={() => !active && !m.disabled && navigate(m.path)}
                sx={{
                  cursor: active || m.disabled ? 'default' : 'pointer', height: '100%', opacity: m.disabled ? 0.6 : 1,
                  borderColor: active ? 'primary.main' : 'divider', borderWidth: active ? 2 : 1,
                  bgcolor: active ? 'rgba(21, 101, 192, 0.06)' : 'background.paper',
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
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Step 1: Manual Selection &amp; GO Details</Typography>
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
            <Typography variant="subtitle1" fontWeight={700}>Step 2: Select Items to Generate (Manual)</Typography>
            <Chip size="small" label={selected.size} color="primary" />
          </Stack>
        </Stack>

        <Grid container>
          <Grid item xs={12} md={8} lg={8.5}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 3, pb: 1.5 }} flexWrap="wrap" useFlexGap>
              <Checkbox size="small" checked={allSelected} onChange={toggleAll} disabled={pagedRows.length === 0} />
              <Typography variant="body2" color="text.secondary">Select All (this page)</Typography>
              <TextField
                size="small" placeholder="Search item code or description..." value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ minWidth: 260, ml: 'auto' }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Stack>

            {loadingProducts ? (
              <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
            ) : (
              <>
                <ScrollableTableContainer maxHeight="clamp(240px, calc(100vh - 560px), 420px)">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>S.No</TableCell>
                        <TableCell>Item Code</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>UOM</TableCell>
                        <TableCell align="right">Order Qty</TableCell>
                        <TableCell>Required Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedRows.map((r, idx) => (
                        <TableRow
                          key={r.productCode} hover selected={activeItem === r.productCode}
                          onClick={() => setActiveItem(r.productCode)} sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox">
                            <Checkbox size="small" checked={selected.has(r.productCode)} onClick={(e) => e.stopPropagation()} onChange={() => toggleRow(r.productCode)} />
                          </TableCell>
                          <TableCell>{page * pageSize + idx + 1}</TableCell>
                          <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.productCode}</Typography></TableCell>
                          <TableCell>{r.productName || '-'}</TableCell>
                          <TableCell>{r.uom || '-'}</TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <TextField
                              size="small" type="number" value={qtyByCode[r.productCode] ?? ''}
                              onChange={(e) => setQtyByCode((p) => ({ ...p, [r.productCode]: e.target.value }))}
                              sx={{ width: 90 }} inputProps={{ style: { textAlign: 'right' } }}
                            />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <TextField
                              size="small" type="date" value={dateByCode[r.productCode] || ''}
                              onChange={(e) => setDateByCode((p) => ({ ...p, [r.productCode]: e.target.value }))}
                              InputLabelProps={{ shrink: true }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>

                <EntityListPagination
                  total={rows.length} page={page} onChange={setPage}
                  pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
                />
              </>
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
                    <Typography variant="body2" fontWeight={700}>{activeItem}</Typography>
                  </Stack>

                  <ToggleButtonGroup size="small" exclusive fullWidth value="bom" sx={{ mb: 1.5 }}>
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
