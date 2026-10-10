import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip, Avatar,
  Table, TableHead, TableBody, TableRow, TableCell, TextField, InputAdornment,
  Tabs, Tab, CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GroupsIcon from '@mui/icons-material/Groups';
import BuildIcon from '@mui/icons-material/Build';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useGetGenerationOrderQuery } from '../../features/productionPlanningApi';
import { isDemoMode } from '../../lib/demoMode';
import { DEMO_GENERATION_ORDER, DEMO_GO_ID } from '../../lib/demoData/generationOrder';

// ---------------------------------------------------------------------------
// Generated Orders — Phase 1 (MRP & Order Generation), approved scope.
// Shows the real Production/Purchase Orders created from a completed
// Generation Order (GET /production-planning/generation-orders/:id, whose
// lines carry resultOrderType/resultOrderId/resultOrderNo once
// generateOrders() has run). Subcontracting and Job Work are not modelled
// in this schema (approved decision 1) and always show as empty here,
// never simulated.
// ---------------------------------------------------------------------------

function fmtDateTime(d) {
  return d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
}
function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

export default function GeneratedOrders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // In demo mode, show the fixed demo Generation Order even if the screen
  // is opened directly with no goId in the URL (see lib/demoMode.js) —
  // outside demo mode this is unchanged.
  const goId = Number(searchParams.get('goId')) || (isDemoMode() ? DEMO_GO_ID : null);
  const { data: realGo, isLoading, isError } = useGetGenerationOrderQuery(goId, { skip: !goId || isDemoMode() });
  // Client-demo path: frontend-only, uses a fixed static Generation Order
  // instead of fetching from the backend (see lib/demoMode.js). Flip
  // DEMO_MODE back to false to restore the real fetch above unchanged.
  const go = isDemoMode() ? DEMO_GENERATION_ORDER : realGo;

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  if (!goId) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">No Generation Order selected.</Typography>
        <Button sx={{ mt: 2 }} variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/production-planning/generate-order-mrp')}>Back</Button>
      </Box>
    );
  }
  if (isLoading) return <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress size={28} /></Box>;
  if (isError || !go) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="error">Could not load this Generation Order.</Typography>
        <Button sx={{ mt: 2 }} variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/production-planning/generate-order-mrp')}>Back</Button>
      </Box>
    );
  }

  const lines = go.lines || [];
  const productionLines = lines.filter((l) => l.orderType === 'Production');
  const purchaseLines = lines.filter((l) => l.orderType === 'Purchase');

  const headerInfo = [
    { label: 'GO Number', value: go.goNumber },
    { label: 'Source Type', value: go.sourceType, isSourceChip: true },
    { label: 'GO Date', value: fmtDate(go.goDate) },
    { label: 'Required Delivery Date', value: fmtDate(go.requiredDeliveryDate) },
    { label: 'Plant / Location', value: go.plant || '-' },
    { label: 'Status', value: go.status, isStatusChip: true },
  ];

  const summaryCards = [
    { key: 'production', label: 'Production Orders', icon: PrecisionManufacturingIcon, color: '#1565c0', value: productionLines.length, status: go.status === 'Completed' ? 'Created' : 'Pending' },
    { key: 'purchase', label: 'Purchase Orders', icon: ShoppingCartIcon, color: '#e65100', value: purchaseLines.length, status: go.status === 'Completed' ? 'Created' : 'Pending' },
    { key: 'subcontracting', label: 'Subcontracting Orders', icon: GroupsIcon, color: '#6a1b9a', value: 0, status: 'Not available' },
    { key: 'jobwork', label: 'Job Work Orders', icon: BuildIcon, color: '#00695c', value: 0, status: 'Not available' },
  ];

  const TABS = [
    { key: 'all', label: `All Orders (${productionLines.length + purchaseLines.length})` },
    { key: 'production', label: `Production Orders (${productionLines.length})` },
    { key: 'purchase', label: `Purchase Orders (${purchaseLines.length})` },
    { key: 'subcontracting', label: 'Subcontracting Orders (0)' },
    { key: 'jobwork', label: 'Job Work Orders (0)' },
  ];

  const showProduction = tab === 'all' || tab === 'production';
  const showPurchase = tab === 'all' || tab === 'purchase';
  const showSubcontracting = tab === 'all' || tab === 'subcontracting';
  const showJobWork = tab === 'all' || tab === 'jobwork';

  const q = search.trim().toLowerCase();
  const filteredProduction = productionLines.filter((r) => !q || (r.resultOrderNo || '').toLowerCase().includes(q) || r.productCode.toLowerCase().includes(q) || (r.productName || '').toLowerCase().includes(q));
  const filteredPurchase = purchaseLines.filter((r) => !q || (r.resultOrderNo || '').toLowerCase().includes(q) || r.productCode.toLowerCase().includes(q) || (r.productName || '').toLowerCase().includes(q));

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Generated Orders"
        subtitle={`List of Production and Purchase orders generated from ${go.goNumber}.`}
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
                ) : f.isStatusChip ? (
                  <Chip size="small" label={f.value} color={f.value === 'Completed' ? 'success' : 'default'} variant="outlined" sx={{ mt: 0.25, fontWeight: 600 }} />
                ) : (
                  <Typography variant="body2" fontWeight={600}>{f.value}</Typography>
                )}
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {summaryCards.map((c) => {
          const Icon = c.icon;
          return (
            <Grid item xs={12} sm={6} md={3} key={c.key}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar sx={{ bgcolor: c.color, width: 44, height: 44 }}>
                      <Icon fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{c.label}</Typography>
                      <Typography variant="h5" fontWeight={700}>{c.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.status}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card variant="outlined">
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 2.5, pt: 1 }}>
          <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44 } }}>
            {TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
          </Tabs>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.5 }} flexWrap="wrap" useFlexGap>
            <TextField
              size="small" placeholder="Search orders..." value={search}
              onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
          </Stack>
        </Stack>

        <Box sx={{ px: 2.5, pb: 2.5 }}>
          {showProduction && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: '#1565c0', width: 28, height: 28 }}>
                  <PrecisionManufacturingIcon sx={{ fontSize: 16 }} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>Production Orders ({filteredProduction.length})</Typography>
              </Stack>
              {filteredProduction.length === 0 ? (
                <Stack direction="row" alignItems="center" spacing={1} justifyContent="center" sx={{ py: 2 }}>
                  <InsertDriveFileOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  <Typography variant="body2" color="text.secondary">
                    {go.status === 'Completed' ? 'No Production Orders in this GO.' : 'Orders have not been generated yet.'}
                  </Typography>
                </Stack>
              ) : (
                <ScrollableTableContainer maxHeight="none">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>S.No</TableCell>
                        <TableCell>Production Order No.</TableCell>
                        <TableCell>FG Item Code</TableCell>
                        <TableCell>FG Description</TableCell>
                        <TableCell align="right">Order Qty</TableCell>
                        <TableCell>UOM</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredProduction.map((r, idx) => (
                        <TableRow key={r.id} hover>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            {r.resultOrderNo
                              ? <Typography variant="body2" color="primary.main" fontWeight={600}>{r.resultOrderNo}</Typography>
                              : <Chip size="small" label="Pending" variant="outlined" />}
                          </TableCell>
                          <TableCell>{r.productCode}</TableCell>
                          <TableCell>{r.productName || '-'}</TableCell>
                          <TableCell align="right">{Number(r.orderQty).toLocaleString('en-IN')}</TableCell>
                          <TableCell>{r.uom || '-'}</TableCell>
                          <TableCell>{fmtDate(r.dueDate)}</TableCell>
                          <TableCell><Chip size="small" label={r.resultOrderNo ? 'Created' : 'Pending'} color={r.resultOrderNo ? 'success' : 'default'} variant="outlined" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>
              )}
            </Box>
          )}

          {showPurchase && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: '#e65100', width: 28, height: 28 }}>
                  <ShoppingCartIcon sx={{ fontSize: 16 }} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>Purchase Orders ({filteredPurchase.length})</Typography>
              </Stack>
              {filteredPurchase.length === 0 ? (
                <Stack direction="row" alignItems="center" spacing={1} justifyContent="center" sx={{ py: 2 }}>
                  <InsertDriveFileOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  <Typography variant="body2" color="text.secondary">
                    {go.status === 'Completed' ? 'No Purchase Orders in this GO.' : 'Orders have not been generated yet.'}
                  </Typography>
                </Stack>
              ) : (
                <ScrollableTableContainer maxHeight="none">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>S.No</TableCell>
                        <TableCell>Purchase Order No.</TableCell>
                        <TableCell>Item Code</TableCell>
                        <TableCell>Item Description</TableCell>
                        <TableCell align="right">Order Qty</TableCell>
                        <TableCell>UOM</TableCell>
                        <TableCell>Vendor</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredPurchase.map((r, idx) => (
                        <TableRow key={r.id} hover>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            {r.resultOrderNo
                              ? <Typography variant="body2" color="primary.main" fontWeight={600}>{r.resultOrderNo}</Typography>
                              : <Chip size="small" label="Pending" variant="outlined" />}
                          </TableCell>
                          <TableCell>{r.productCode}</TableCell>
                          <TableCell>{r.productName || '-'}</TableCell>
                          <TableCell align="right">{Number(r.orderQty).toLocaleString('en-IN')}</TableCell>
                          <TableCell>{r.uom || '-'}</TableCell>
                          <TableCell>{r.vendorCode || '-'}</TableCell>
                          <TableCell>{fmtDate(r.dueDate)}</TableCell>
                          <TableCell><Chip size="small" label={r.resultOrderNo ? 'Created' : 'Pending'} color={r.resultOrderNo ? 'success' : 'default'} variant="outlined" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTableContainer>
              )}
            </Box>
          )}

          {showSubcontracting && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: '#6a1b9a', width: 28, height: 28 }}>
                  <GroupsIcon sx={{ fontSize: 16 }} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>Subcontracting Orders (0)</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} justifyContent="center" sx={{ py: 2 }}>
                <InsertDriveFileOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary">Subcontracting Orders are not available yet in this system.</Typography>
              </Stack>
            </Box>
          )}

          {showJobWork && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                <Avatar sx={{ bgcolor: '#00695c', width: 28, height: 28 }}>
                  <BuildIcon sx={{ fontSize: 16 }} />
                </Avatar>
                <Typography variant="subtitle1" fontWeight={700}>Job Work Orders (0)</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} justifyContent="center" sx={{ py: 2 }}>
                <InsertDriveFileOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                <Typography variant="body2" color="text.secondary">Job Work Orders are not available yet in this system.</Typography>
              </Stack>
            </Box>
          )}
        </Box>
      </Card>

      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/production-planning/generate-order-mrp')}>
          Back to Generate Orders
        </Button>
      </Stack>
    </Box>
  );
}
